import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { ObjectId } from 'mongodb';
import { v4 as uuid4 } from 'uuid';
import dbClient from '../utils/db';
import fileQueue from '../worker';

class FilesController {
  static async getShow(req, res) {
    const { id } = req.params;
    const filesCollection = dbClient.db.collection('files');
    const { userId } = res.locals;
    const file = await filesCollection.findOne({
      $and: [{ userId }, { _id: ObjectId(id) }],
    });
    if (!file) return res.status(404).json({ error: 'Not found' });
    const { _id, localPath, ...rest } = file;
    return res.json({ id: _id, ...rest });
  }

  static async getIndex(req, res) {
    let { parentId } = req.query;
    const { page } = req.query;
    const filesCollection = dbClient.db.collection('files');
    if (parentId === undefined) {
      const files = await filesCollection
        .aggregate([
          { $skip: (page || 0) * 20 },
          { $limit: 20 },
          {
            $project: {
              id: '$_id',
              userId: 1,
              name: 1,
              type: 1,
              isPublic: 1,
              parentId: 1,
            },
          },
          {
            $unset: ['_id', 'localPath'],
          },
        ])
        .toArray();
      return res.json(files);
    }
    if (parentId !== '0') {
      const count = await filesCollection.countDocuments({
        $and: [{ type: 'folder' }, { _id: ObjectId(parentId) }],
      });
      if (count === 0) return res.json([]);
    }
    if (parentId === '0') {
      parentId = 0;
    }
    const files = await filesCollection
      .aggregate([
        { $match: { parentId } },
        { $skip: (page || 0) * 20 },
        { $limit: 20 },
        {
          $project: {
            id: '$_id',
            _id: 0,
            userId: 1,
            name: 1,
            type: 1,
            isPublic: 1,
            parentId: 1,
          },
        },
        {
          $unset: 'localPath',
        },
      ])
      .toArray();

    return res.json(files);
  }

  static async postUpload(req, res) {
    const {
      // prettier-ignore
      name,
      type,
      data,
      parentId,
      isPublic,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    const fileTypes = ['file', 'image', 'folder'];
    if (!type || !fileTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    const filesCollection = dbClient.db.collection('files');
    if (parentId) {
      const parentFile = await filesCollection.findOne({
        _id: ObjectId(parentId),
      });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    const { userId } = res.locals;
    if (type === 'folder') {
      const folderData = {
        userId,
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId || 0,
      };

      const folderStored = await filesCollection.insertOne({ ...folderData });
      return res
        .status(201)
        .json({ id: folderStored.insertedId, ...folderData });
    }
    const localPath = process.env.FOLDER_PATH;
    const localFolder = localPath
      ? path.join(__dirname, localPath)
      : '/tmp/files_manager';
    if (!fs.existsSync(localFolder)) fs.mkdirSync(localFolder);
    const localFilePath = path.join(localFolder, uuid4());
    const fileBytes = Buffer.from(data, 'base64');
    // prettier-ignore
    const fileContent = type === 'file' ? fileBytes.toString('utf-8') : fileBytes;
    fs.writeFileSync(localFilePath, fileContent);
    const newFileData = {
      userId,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || 0,
    };
    const newFile = await filesCollection.insertOne({
      ...newFileData,
      localPath: localFilePath,
    });
    if (type === 'image') {
      fileQueue.add({ fileId: newFile.insertedId, userId });
    }
    return res.status(201).json({ id: newFile.insertedId, ...newFileData });
  }

  static async putPublish(req, res) {
    const { id } = req.params;
    const { userId } = res.locals;
    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({
      $and: [{ userId }, { _id: ObjectId(id) }],
    });
    if (!file) return res.status(404).json({ error: 'Not found' });
    const { _id, localPath, ...rest } = file;
    if (file.isPublic) return res.json({ id: _id, ...rest });
    const result = await filesCollection.updateOne(
      { _id: file._id },
      { $set: { isPublic: true } },
    );
    if (result.modifiedCount !== 1) {
      return res.status(500).json({ error: 'Something went wrong' });
    }
    return res.json({ id: _id, ...rest, isPublic: true });
  }

  static async putUnpublish(req, res) {
    const { id } = req.params;
    const filesCollection = dbClient.db.collection('files');
    const { userId } = res.locals;
    try {
      const file = await filesCollection.findOne({
        $and: [{ userId }, { _id: ObjectId(id) }],
      });
      if (!file) return res.status(404).json({ error: 'Not found' });
      const { _id, localPath, ...rest } = file;
      if (!file.isPublic) return res.json({ id: _id, ...rest });
      await filesCollection.updateOne(
        { _id: file._id },
        { $set: { isPublic: false } },
      );
      return res.json({ id: _id, ...rest, isPublic: false });
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const { size } = req.query;
    const file = await dbClient.db
      .collection('files')
      .findOne({ _id: ObjectId(id) });
    const { userId } = res.locals;
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (!file.isPublic && (!userId || userId !== file.userId)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }
    const localFilePath = size ? `${file.localPath}_${size}` : file.localPath;
    if (!fs.existsSync(localFilePath)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const mimeType = mime.lookup(file.name);
    res.type(mimeType);
    return res.sendFile(localFilePath);
  }
}

export default FilesController;

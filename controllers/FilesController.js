import path from 'path';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import { v4 as uuid4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async getShow(req, res) {
    const { id } = req.params;
    const token = req.get('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({
      $and: [{ userId }, { _id: ObjectId(id) }],
    });
    if (!file) return res.status(404).json({ error: 'Not found' });
    const { _id, localPath, ...rest } = file;
    return res.json({ id: _id, ...rest });
  }

  static async getIndex(req, res) {
    const token = req.get('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!token || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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
    const token = req.get('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!token || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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
    if (type === 'folder') {
      const folderData = {
        userId,
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId || 0,
      };

      const folderStored = await filesCollection.insertOne({ ...folderData });
      console.log(folderData);
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
    fs.writeFileSync(
      localFilePath,
      Buffer.from(data, 'base64').toString('utf-8'),
    );
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
    return res.status(201).json({ id: newFile.insertedId, ...newFileData });
  }
}

export default FilesController;

import fs from 'fs';
import imageThumbnail from 'image-thumbnail';
import Bull from 'bull';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Bull('file-queue');
fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;
  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');
  const file = await dbClient.db
    .collection('files')
    .findOne({ $and: [{ _id: ObjectId(fileId) }, { userId }] });
  if (!file) throw new Error('File not found');
  const sizes = [500, 250, 100];
  sizes.forEach(async (size) => {
    const thumbBuffer = await imageThumbnail(file.localPath, { width: size });
    fs.writeFileSync(`${file.localPath}_${size}`, thumbBuffer);
  });
});

export default fileQueue;

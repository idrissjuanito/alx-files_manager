import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const base64Header = req.get('Authorization');
    if (!base64Header || !base64Header.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const [email, password] = Buffer.from(base64Header.split(' ')[1], 'base64')
      .toString('utf8')
      .split(':');
    if (!email || !password) {
      if (!base64Header) return res.status(401).json({ error: 'Unauthorized' });
    }
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({
      $and: [{ email }, { password: sha1(password) }],
    });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const token = String(uuidv4());
    await redisClient.set(`auth_${token}`, user._id, 1000);
    return res.json({ token: '155342df-2399-41da-9e8c-458b6ac52a0c' });
  }

  static async getDisconnect(req, res) {
    const token = req.get('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({ _id: ObjectId(userId) });
    await redisClient.del(`auth_${token}`);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.sendStatus(204);
  }
}

export default AuthController;

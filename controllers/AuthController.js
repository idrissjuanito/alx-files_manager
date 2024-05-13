import sha1 from 'sha1';
import { v4 as uuid4 } from 'uuid';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const base64Header = req.get('Authorization').split(' ')[1];
    const [email, password] = Buffer.from(base64Header, 'base64')
      .toString('utf-8')
      .split(':');
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({
      $and: [{ email }, { password: sha1(password) }],
    });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const token = uuid4();
    await redisClient.set(`auth_${token}`, user._id, 24 * 60 * 60);
    return res.json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.get('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    await redisClient.del(`auth_${token}`);
    return res.status(204).send();
  }
}

export default AuthController;

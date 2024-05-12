import sha1 from "sha1";
import { ObjectId } from "mongodb";
import dbClient from "../utils/db";
import redisClient from "../utils/redis";

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });
    if (!password) return res.status(400).json({ error: "Missing password" });
    const collection = dbClient.db.collection("users");
    let user = await collection.findOne({ email });
    if (user !== null) return res.status(400).json({ error: "Already exists" });
    user = await collection.insertOne({ email, password: sha1(password) });
    return res.status(201).json({ id: user.insertedId, email });
  }

  static async getMe(req, res) {
    return new Promise((resolve, reject) => {
      const token = req.get("X-Token");
      redisClient.get(`auth_${token}`).then((userId) => {
        if (!userId) {
          return reject(res.status(401).json({ error: "Unauthorized" }));
        }
        return (async () => {
          const users = dbClient.db.collection("users");
          try {
            const user = await users.findOne({ _id: ObjectId(userId) });
            return resolve(res.json({ id: user._id, email: user.email }));
          } catch (err) {
            console.log(err);
            return reject(res.status(500).send());
          }
        })();
      });
    });
  }
}

export default UsersController;

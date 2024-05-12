import { MongoClient } from "mongodb";

const host = process.env.DB_HOST || "localhost";
const port = process.env.DB_PORT || "27017";
const database = process.env.DB_DATABASE || "files_manager";

class DBClient {
  constructor() {
    this.db = null;
    MongoClient.connect(`mongodb://${host}:${port}`, (err, client) => {
      if (err) return;
      this.db = client.db(database);
    });
  }

  isAlive() {
    return this.db == null ? false : true;
  }

  async nbUsers() {
    return new Promise((resolve, reject) => {
      const collection = this.db.collection("users");
      collection.find({}).toArray((err, docs) => {
        if (err) reject(err);
        resolve(docs.length);
      });
    });
  }

  async nbFiles() {
    return new Promise((resolve, reject) => {
      const collection = this.db.collection("files");
      collection.find({}).toArray((err, docs) => {
        if (err) reject(err);
        resolve(docs.length);
      });
    });
  }
}

const dbClient = new DBClient();
export default dbClient;

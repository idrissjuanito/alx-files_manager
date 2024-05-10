import { redisClient } from "redis";
import { promisify } from "util";

class RedisClient {
  constructor() {
    this.client = redisClient()
      .on("error", (error) => console.log(error))
      .connect();
  }
  isAlive() {
    return this.client.isReady;
  }

  async get(key) {
    const getter = promisify(this.client.get).bind(this.client);
    return await getter(key);
  }

  async set(key, value, expiration) {
    const setter = promisify(this.client.set).bind(this.client);
    await setter(key, value, { EX: expiration });
  }

  async del(key) {
    const del = promisify(this.client.del).bind(this.client);
    await del(key);
  }
}

const redisClient = RedisClient();
export default redisClient;

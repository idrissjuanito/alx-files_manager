import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) => console.log(err));
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    const getter = promisify(this.client.get).bind(this.client);
    return getter(key);
  }

  async set(key, value, expiration) {
    const setter = promisify(this.client.set).bind(this.client);
    await setter(key, value, 'EX', expiration);
  }

  async del(key) {
    const del = promisify(this.client.del).bind(this.client);
    await del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;

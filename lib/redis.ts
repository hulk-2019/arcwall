import IORedis from 'ioredis';

const REDIS_URL: any = process.env.REDIS_URL;

const globalForRedis = global as unknown as { redis: IORedis };

export const redis =
  globalForRedis.redis ||
  new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = "READONLY";
      if (err.message.slice(0, targetError.length) === targetError) {
        // Only reconnect when the error starts with "READONLY"
        return true;
      }
      return false;
    },
  });

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

import IORedis from 'ioredis';

const REDIS_URL: any = process.env.REDIS_URL;

const globalForRedis = global as unknown as { redis: IORedis };

function createRedisClient(): IORedis {
  const client = new IORedis(REDIS_URL, {
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

  client.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  // 建连日志默认静默（轮询场景刷屏且无信息量）；设 REDIS_DEBUG=1 排查连接问题时输出，
  // 带 pid 便于发现多实例/重复建连
  let logged = false;
  client.on('connect', () => {
    if (!logged) {
      logged = true;
      if (process.env.REDIS_DEBUG) {
        console.log(`[redis] connected (pid ${process.pid})`);
      }
    }
  });

  return client;
}

// 无条件缓存到全局：避免 dev 多入口模块实例化时重复建连（连接泄漏 + 日志刷屏）
export const redis = globalForRedis.redis ?? createRedisClient();
globalForRedis.redis = redis;

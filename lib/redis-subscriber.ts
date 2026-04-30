import IORedis from "ioredis";
import { redisKeys } from "./constants";

const REDIS_URL: any = process.env.REDIS_URL;

// Each call returns a fresh connection dedicated to subscribe mode.
// ioredis connections in subscribe mode cannot issue regular commands,
// so we never reuse the shared `redis` instance for this purpose.
export function createSubscriber(): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      return Math.min(times * 50, 2000);
    },
  });
}

export function wallpaperStatusChannel(userId: number): string {
  return redisKeys.wallpaperStatusChannel(userId);
}

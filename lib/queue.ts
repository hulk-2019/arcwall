import { getRabbitMQChannel } from './rabbitmq';
import { redis } from './redis';
import { randomUUID } from 'crypto';
import { QUEUE_WALLPAPER_GENERATION, redisKeys, redisTTL } from './constants';

export const wallpaperQueue = {
  add: async (name: string, data: any) => {
    const channel = await getRabbitMQChannel();
    await channel.assertQueue(QUEUE_WALLPAPER_GENERATION, { durable: true });

    const jobId = randomUUID();
    const jobKey = redisKeys.jobData(jobId);

    await redis.set(jobKey, JSON.stringify({ name, data }), 'EX', redisTTL.jobData);

    const message = JSON.stringify({ jobId });
    const sent = channel.sendToQueue(QUEUE_WALLPAPER_GENERATION, Buffer.from(message), { persistent: true });

    if (!sent) {
      console.warn('RabbitMQ queue full, message might be dropped or delayed');
    }
    return sent;
  }
};

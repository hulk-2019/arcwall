import { getRabbitMQChannel } from './rabbitmq';
import { redis } from './redis';
import { randomUUID } from 'crypto';

export const QUEUE_NAME = 'wallpaper-generation';

export const wallpaperQueue = {
  add: async (name: string, data: any) => {
    const channel = await getRabbitMQChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    const jobId = randomUUID();
    const jobKey = `job:${jobId}`;

    // Store job data in Redis with 24h expiration
    await redis.set(jobKey, JSON.stringify({ name, data }), 'EX', 86400);

    // Send Job ID to RabbitMQ
    const message = JSON.stringify({ jobId });
    const sent = channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });

    if (!sent) {
      console.warn('RabbitMQ queue full, message might be dropped or delayed');
    }
    return sent;
  }
};

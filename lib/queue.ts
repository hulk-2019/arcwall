import { getRabbitMQChannel } from './rabbitmq';
import { redis } from './redis';
import { randomUUID } from 'crypto';
import { QUEUE_WALLPAPER_GENERATION, QUEUE_CANVAS_STEP, redisKeys, redisTTL } from './constants';

async function enqueue(queueName: string, name: string, data: any) {
  const channel = await getRabbitMQChannel();
  await channel.assertQueue(queueName, { durable: true });

  const jobId = randomUUID();
  const jobKey = redisKeys.jobData(jobId);

  await redis.set(jobKey, JSON.stringify({ name, data }), 'EX', redisTTL.jobData);

  const message = JSON.stringify({ jobId });
  const sent = channel.sendToQueue(queueName, Buffer.from(message), { persistent: true });

  if (!sent) {
    console.warn('RabbitMQ queue full, message might be dropped or delayed');
  }
  return { sent, jobId };
}

export const wallpaperQueue = {
  add: async (name: string, data: any) => {
    return (await enqueue(QUEUE_WALLPAPER_GENERATION, name, data)).sent;
  }
};

export const canvasQueue = {
  add: async (name: string, data: any) => {
    return enqueue(QUEUE_CANVAS_STEP, name, data);
  }
};

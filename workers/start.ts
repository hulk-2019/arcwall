import 'dotenv/config';
import { wallpaperWorker } from './wallpaper-worker';
import { canvasWorker } from './canvas-worker';

console.log('Worker started...');
wallpaperWorker.start();
canvasWorker.start();

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, closing workers...`);
  await wallpaperWorker.close();
  await canvasWorker.close();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

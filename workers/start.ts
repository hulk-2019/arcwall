import 'dotenv/config';
import { wallpaperWorker } from './wallpaper-worker';

console.log('Worker started...');
wallpaperWorker.start();

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, closing worker...`);
  await wallpaperWorker.close();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

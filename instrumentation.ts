export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('Registering worker...');
    // Import the worker to start it
    await import('./workers/wallpaper-worker');
  }
}

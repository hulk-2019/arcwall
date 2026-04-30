// RabbitMQ
export const QUEUE_WALLPAPER_GENERATION = "wallpaper-generation";

// Redis keys
export const redisKeys = {
  userByEmail: (email: string) => `user:email:${email}`,
  dictionaryLabelMaps: "dictionaries:label_maps",
  wallpaperProcessingLock: (wallpaperId: number) => `processing:${wallpaperId}`,
  genWallpaperConcurrencyLock: (userId: number) => `lock:gen_wallpaper:${userId}`,
  genWallpaperRateLimit: (userId: number) => `rate_limit:gen_wallpaper:${userId}`,
  jobData: (jobId: string) => `job:${jobId}`,
  taskProgress: (wallpaperId: number) => `task:progress:${wallpaperId}`,
  taskResult: (wallpaperId: number) => `task:result:${wallpaperId}`,
  wallpaperStatusChannel: (userId: number) => `wallpaper:status:${userId}`,
};

// Redis TTLs (seconds)
export const redisTTL = {
  userCache: 300,        // 5 minutes
  dictionaryCache: 3600, // 1 hour
  processingLock: 600,   // 10 minutes
  concurrencyLock: 5,    // 5 seconds
  rateLimitWindow: 60,   // 1 minute
  jobData: 86400,        // 24 hours
  taskProgress: 600,     // 10 minutes
};

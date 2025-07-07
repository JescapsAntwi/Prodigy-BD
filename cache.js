const Redis = require('ioredis');
require('dotenv').config();

const redisClient = new Redis(process.env.REDIS_URI || 'redis://localhost:6379');

// Cache middleware
const cache = (key, ttl = 3600) => { // Default TTL: 1 hour
  return async (req, res, next) => {
    const cacheKey = key || req.originalUrl;
    
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log('Serving from cache');
        return res.json(JSON.parse(cachedData));
      }
      
      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = (body) => {
        if (res.statusCode === 200) {
          redisClient.setex(cacheKey, ttl, JSON.stringify(body));
        }
        return originalJson.call(res, body);
      };
      
      next();
    } catch (error) {
      console.error('Cache error:', error);
      next();
    }
  };
};

// Clear cache by key pattern
const clearCache = (keyPattern) => {
  return async (req, res, next) => {
    try {
      const keys = await redisClient.keys(keyPattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`Cleared cache for pattern: ${keyPattern}`);
      }
      next();
    } catch (error) {
      console.error('Cache clear error:', error);
      next();
    }
  };
};

module.exports = { redisClient, cache, clearCache };
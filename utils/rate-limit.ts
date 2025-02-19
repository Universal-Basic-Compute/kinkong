import { LRUCache } from 'lru-cache';

export interface RateLimitOptions {
  uniqueTokenPerInterval?: number;
  interval?: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval || 60000,
  });

  return {
    check: (limit: number, token: string): Promise<RateLimitResult> =>
      new Promise((resolve, reject) => {
        const tokenCount = tokenCache.get(token) || [0];
        const currentUsage = tokenCount[0];
        const currentTime = Date.now();
        
        // Get TTL by checking remaining time
        const ttl = Math.max(0, (tokenCache.getRemainingTTL(token) || 0));

        if (currentUsage === 0) {
          tokenCache.set(token, [1]);
          return resolve({
            success: true,
            limit,
            remaining: limit - 1,
            reset: currentTime + ttl
          });
        }

        if (currentUsage < limit) {
          tokenCache.set(token, [currentUsage + 1]);
          return resolve({
            success: true,
            limit,
            remaining: limit - currentUsage - 1,
            reset: currentTime + ttl
          });
        }

        reject({
          success: false,
          limit,
          remaining: 0,
          reset: currentTime + ttl
        });
      }),
  };
}

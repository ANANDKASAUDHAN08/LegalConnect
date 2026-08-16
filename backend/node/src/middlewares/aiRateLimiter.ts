import { Request, Response, NextFunction } from 'express';
import { incrRateLimitKey } from '../services/statsService';

export interface AiRateLimitOptions {
  windowMs?: number;    // Time window in milliseconds (default: 60,000ms = 1 min)
  maxRequests?: number; // Max requests per window per IP (default: 15)
  maxCharLength?: number; // Max character length for prompt/description (default: 4000)
}

/**
 * Enterprise AI Protection Middleware:
 * Provides Redis-backed / in-memory sliding-window IP rate limiting, input sanitization, and prompt payload length bounds.
 */
export const createAiRateLimiter = (options: AiRateLimitOptions = {}) => {
  const windowMs = options.windowMs || 60 * 1000;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const maxRequests = options.maxRequests || 15;
  const maxCharLength = options.maxCharLength || 4000;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'anonymous';
      const ip = rawIp.split(',')[0].trim();

      const rateKey = `rate:ai:${ip}`;
      const { count, ttlSeconds } = await incrRateLimitKey(rateKey, windowSeconds);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + ttlSeconds);

      if (count > maxRequests) {
        res.setHeader('Retry-After', ttlSeconds);
        return res.status(429).json({
          success: false,
          message: 'AI query limit reached. Please wait a moment before sending more legal questions.',
          retryAfterSeconds: ttlSeconds
        });
      }

      // Prompt payload inspection & sanitization guard
      if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
        const textFields = ['question', 'description', 'prompt', 'text', 'content', 'introduction_text', 'introduction_text_hi', 'title', 'title_hi'];
        for (const field of textFields) {
          if (typeof req.body[field] === 'string') {
            if (req.body[field].length > maxCharLength) {
              return res.status(400).json({
                success: false,
                message: `AI input payload exceeds maximum allowed character limit of ${maxCharLength} characters.`
              });
            }
            // Basic sanitization against dangerous null bytes
            req.body[field] = req.body[field].replace(/\0/g, '');
          }
        }
      }

      next();
    } catch (err) {
      console.error('Rate limiter middleware error:', err);
      next();
    }
  };
};

export const defaultAiRateLimiter = createAiRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  maxCharLength: 4000
});
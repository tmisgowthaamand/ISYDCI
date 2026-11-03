import rateLimit from 'express-rate-limit'

/**
 * 1. Admin Login Rate Limiter
 * Protects against brute-force password guessing attacks.
 * Max 10 failed login attempts per 15 minutes per IP.
 * Successful logins are NOT counted against the quota.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 failed attempts
  skipSuccessfulRequests: true, // Only count failed logins
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many failed login attempts from this IP. Please try again after 15 minutes.',
  },
})

/**
 * 2. Member Registration & Card Generation Rate Limiter
 * Protects server CPU and disk storage from automated bot spam.
 * Max 15 card registrations per minute per IP.
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registrations from this IP. Please wait a minute before registering again.',
  },
})

/**
 * 3. General API Rate Limiter
 * Standard API DDoS / flood protection (120 requests / min).
 * Completely bypasses WhatsApp webhooks and health endpoints so Meta messages are NEVER throttled.
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const url = req.originalUrl || req.url || ''
    // NEVER throttle Meta WhatsApp webhooks, Flow endpoints, or health monitors
    return (
      url.includes('/api/whatsapp/') ||
      url.includes('/webhook') ||
      url.includes('/api/health') ||
      url.includes('/api/live-logs') ||
      url.includes('/api/flow-log')
    )
  },
  message: {
    success: false,
    message: 'Too many requests from this IP. Please slow down.',
  },
})

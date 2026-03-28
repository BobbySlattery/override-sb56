import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store keyed by "routeName:ip"
// Note: On Vercel serverless, this resets on cold starts, but still
// provides meaningful protection against rapid-fire abuse within a
// single instance. For persistent rate limiting, use Redis or Supabase.
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}

/**
 * Simple in-memory rate limiter for API routes.
 *
 * @param request - The incoming request (used to extract IP)
 * @param routeName - A unique name for this route (e.g. "send-email")
 * @param maxRequests - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns null if allowed, or a NextResponse 429 if rate limited
 */
export function rateLimit(
  request: NextRequest,
  routeName: string,
  maxRequests: number,
  windowMs: number
): NextResponse | null {
  cleanup();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const key = `${routeName}:${ip}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    // First request or window expired — start fresh
    store.set(key, { count: 1, resetTime: now + windowMs });
    return null;
  }

  if (entry.count >= maxRequests) {
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: retryAfterSec,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
        },
      }
    );
  }

  entry.count++;
  return null;
}

// In-memory sliding window rate limiter per IP (15 requests/min)
const ipSearchLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkSearchRateLimit(
  ip: string,
  maxRequests: number = 15,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const record = ipSearchLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    ipSearchLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) {
    return false;
  }
  record.count++;
  return true;
}

export function resetSearchRateLimit(): void {
  ipSearchLimitMap.clear();
}

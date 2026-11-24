import { HttpException } from "@nestjs/common";

const buckets = new Map<string, { count: number; until: number }>();
const cleanup = setInterval(() => {
  for (const [key, bucket] of buckets)
    if (bucket.until <= Date.now()) buckets.delete(key);
}, 60_000);
cleanup.unref();
export function limit(key: string, max: number, windowMs = 60_000) {
  const current = buckets.get(key);
  if (!current || current.until <= Date.now()) {
    buckets.set(key, { count: 1, until: Date.now() + windowMs });
    return;
  }
  if (++current.count > max)
    throw new HttpException(
      "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
      429,
    );
}

import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { STORAGE_REDIS } from '../../infrastructure/queue/storage-queue.constants';

const QUOTA_SCRIPT = `
local key = KEYS[1]
local leaseKey = KEYS[2]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxBytes = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local maxSessions = tonumber(ARGV[5])
local leaseTtlMs = tonumber(ARGV[6])

local windowStart = redis.call('HGET', key, 'windowStart')
local used = redis.call('HGET', key, 'used')
local sessions = redis.call('GET', leaseKey) or '0'

if not windowStart or (now - tonumber(windowStart)) >= windowMs then
  windowStart = now
  used = 0
end

if (tonumber(used) + requested) > maxBytes then
  return {0, used, sessions}
end

if tonumber(sessions) >= maxSessions then
  return {0, used, sessions}
end

used = tonumber(used) + requested
redis.call('HSET', key, 'windowStart', windowStart, 'used', used)
redis.call('PEXPIRE', key, windowMs)
redis.call('INCR', leaseKey)
redis.call('PEXPIRE', leaseKey, leaseTtlMs)
return {1, used, sessions + 1}
`;

const RELEASE_SESSION_SCRIPT = `
local leaseKey = KEYS[1]
local current = tonumber(redis.call('GET', leaseKey) or '0')
if current <= 1 then
  redis.call('DEL', leaseKey)
else
  redis.call('DECR', leaseKey)
end
return 1
`;

@Injectable()
export class UploadQuotaService {
  constructor(@Inject(STORAGE_REDIS) private readonly redis: Redis) {}

  async tryAcquire(params: {
    ownerUserId: number;
    profile: string;
    byteSize: number;
    quotaBytesPerMinute: number;
    maxConcurrentUploads: number;
    leaseTtlMs?: number;
  }): Promise<boolean> {
    const quotaKey = `storage:quota:${params.ownerUserId}:${params.profile}`;
    const leaseKey = `storage:lease:${params.ownerUserId}:${params.profile}`;
    const now = Date.now();
    const windowMs = 60_000;
    const leaseTtlMs = params.leaseTtlMs ?? 3_600_000;

    const result = (await this.redis.eval(
      QUOTA_SCRIPT,
      2,
      quotaKey,
      leaseKey,
      now,
      windowMs,
      params.quotaBytesPerMinute,
      params.byteSize,
      params.maxConcurrentUploads,
      leaseTtlMs,
    )) as [number, number, number];

    return result[0] === 1;
  }

  async releaseSession(ownerUserId: number, profile: string): Promise<void> {
    const leaseKey = `storage:lease:${ownerUserId}:${profile}`;

    await this.redis.eval(RELEASE_SESSION_SCRIPT, 1, leaseKey);
  }

  async acquireSessionLock(sessionId: string, ttlMs = 30_000): Promise<boolean> {
    const result = await this.redis.set(
      `storage:session-lock:${sessionId}`,
      '1',
      'PX',
      ttlMs,
      'NX',
    );

    return result === 'OK';
  }

  async releaseSessionLock(sessionId: string): Promise<void> {
    await this.redis.del(`storage:session-lock:${sessionId}`);
  }
}

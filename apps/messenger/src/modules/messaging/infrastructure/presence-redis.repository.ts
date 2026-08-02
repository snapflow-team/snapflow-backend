import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../core/providers/provide-tokens/redis-client.inject-token';
import { Configuration } from '../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../setup/configuration/business-rules-settings';

@Injectable()
export class PresenceRedisRepository {
  constructor(
    @Inject(REDIS_CLIENT_INJECT_TOKEN) private readonly redis: Redis,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async addConnection(userId: number, socketId: string): Promise<boolean> {
    const key = this.key(userId);
    const now = Date.now();
    const ttlSeconds = this.ttlSeconds();
    const staleBefore = now - ttlSeconds * 1000;

    await this.redis.zremrangebyscore(key, '-inf', staleBefore);
    const previousCount = await this.redis.zcard(key);

    const multi = this.redis.multi();
    multi.zadd(key, now, socketId);
    multi.expire(key, ttlSeconds);
    await multi.exec();

    return previousCount === 0;
  }

  async refresh(userId: number, socketId: string): Promise<void> {
    const key = this.key(userId);
    const now = Date.now();
    const ttlSeconds = this.ttlSeconds();

    const multi = this.redis.multi();
    multi.zadd(key, now, socketId);
    multi.expire(key, ttlSeconds);
    await multi.exec();
  }

  async removeConnection(userId: number, socketId: string): Promise<number> {
    const key = this.key(userId);
    const now = Date.now();
    const ttlSeconds = this.ttlSeconds();
    const staleBefore = now - ttlSeconds * 1000;

    const multi = this.redis.multi();
    multi.zrem(key, socketId);
    multi.zremrangebyscore(key, '-inf', staleBefore);
    multi.zcard(key);
    const results = await multi.exec();

    const zcardResult = results?.[2]?.[1];
    return typeof zcardResult === 'number' ? zcardResult : Number(zcardResult ?? 0);
  }

  async getOnline(userIds: number[]): Promise<Map<number, boolean>> {
    const online = new Map<number, boolean>();
    if (userIds.length === 0) {
      return online;
    }

    const now = Date.now();
    const ttlSeconds = this.ttlSeconds();
    const staleBefore = now - ttlSeconds * 1000;
    const pipeline = this.redis.pipeline();

    for (const userId of userIds) {
      const key = this.key(userId);
      pipeline.zremrangebyscore(key, '-inf', staleBefore);
      pipeline.zcard(key);
    }

    const results = await pipeline.exec();
    if (!results) {
      for (const userId of userIds) {
        online.set(userId, false);
      }
      return online;
    }

    for (let i = 0; i < userIds.length; i++) {
      const zcardReply = results[i * 2 + 1]?.[1];
      const count = typeof zcardReply === 'number' ? zcardReply : Number(zcardReply ?? 0);
      online.set(userIds[i], count > 0);
    }

    return online;
  }

  private key(userId: number): string {
    return `presence:${userId}`;
  }

  private ttlSeconds(): number {
    return this.configService.get<BusinessRulesSettings>('businessRulesSettings')
      .presenceHeartbeatTtlSeconds;
  }
}

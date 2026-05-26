import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { HOME_REVALIDATION_REDIS_KEYS } from '../constants/home-revalidation.constants';

@Injectable()
export class HomeRevalidationCountersStore {
  constructor(@Inject(REDIS_CLIENT_INJECT_TOKEN) private readonly redis: Redis) {}

  async incrementPosts(): Promise<number> {
    return this.redis.incr(HOME_REVALIDATION_REDIS_KEYS.posts);
  }

  async incrementSignups(): Promise<number> {
    return this.redis.incr(HOME_REVALIDATION_REDIS_KEYS.signups);
  }

  async getPostsCount(): Promise<number> {
    const value = await this.redis.get(HOME_REVALIDATION_REDIS_KEYS.posts);

    return Number(value ?? 0);
  }

  async getSignupsCount(): Promise<number> {
    const value = await this.redis.get(HOME_REVALIDATION_REDIS_KEYS.signups);

    return Number(value ?? 0);
  }

  async resetBoth(): Promise<void> {
    await Promise.all([
      this.redis.set(HOME_REVALIDATION_REDIS_KEYS.posts, 0),
      this.redis.set(HOME_REVALIDATION_REDIS_KEYS.signups, 0),
    ]);
  }
}

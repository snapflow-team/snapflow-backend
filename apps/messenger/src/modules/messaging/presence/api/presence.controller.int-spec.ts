import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../../../../libs/common/constants/global-prefix.constant';
import { AccessTokenTestHelper } from '../../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';

describe('PresenceController (Integration)', () => {
  let appTestManager: AppTestManager;
  let accessTokenTestHelper: AccessTokenTestHelper;
  let redis: Redis;

  async function cleanupPresenceRedis(): Promise<void> {
    const keys = await redis.keys('presence:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    redis = appTestManager.getApp().get(REDIS_CLIENT_INJECT_TOKEN);
    if (redis.status === 'wait') {
      await redis.connect();
    }

    const apiSettings = appTestManager
      .getApp()
      .get(ConfigService<Configuration, true>)
      .get<ApiSettings>('apiSettings');
    const jwtService = new JwtService({ secret: apiSettings.accessTokenSecret });

    accessTokenTestHelper = new AccessTokenTestHelper(jwtService);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    await cleanupPresenceRedis();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  describe('GET /messenger/presence', () => {
    it('должен вернуть батч online/lastSeenAt', async () => {
      await appTestManager.prisma.userPresenceSettings.create({
        data: {
          userId: 3,
          showActivityStatus: true,
          lastSeenAt: new Date('2026-07-19T11:00:00.000Z'),
        },
      });

      await redis.zadd('presence:2', Date.now(), 'sock-2');
      await redis.expire('presence:2', 30);

      const response = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .query({ userIds: '2,3' })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(response.body).toEqual([
        { userId: '2', online: true, lastSeenAt: null },
        { userId: '3', online: false, lastSeenAt: '2026-07-19T11:00:00.000Z' },
      ]);
    });

    it('должен скрывать статус при взаимной приватности (цель скрыла активность)', async () => {
      await appTestManager.prisma.userPresenceSettings.create({
        data: {
          userId: 2,
          showActivityStatus: false,
          lastSeenAt: new Date('2026-07-19T11:00:00.000Z'),
        },
      });

      await redis.zadd('presence:2', Date.now(), 'sock-2');
      await redis.expire('presence:2', 30);

      const response = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .query({ userIds: '2' })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(response.body).toEqual([{ userId: '2', online: false, lastSeenAt: null }]);
    });

    it('должен скрывать чужие статусы, если запрашивающий скрыл активность', async () => {
      await appTestManager.prisma.userPresenceSettings.create({
        data: {
          userId: 1,
          showActivityStatus: false,
        },
      });

      await redis.zadd('presence:2', Date.now(), 'sock-2');
      await redis.expire('presence:2', 30);

      const response = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .query({ userIds: '2' })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(response.body).toEqual([{ userId: '2', online: false, lastSeenAt: null }]);
    });

    it('должен вернуть 400 без userIds', async () => {
      await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(400);
    });

    it('должен вернуть 401 без authorization header', async () => {
      await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .query({ userIds: '2' })
        .expect(401);
    });
  });
});

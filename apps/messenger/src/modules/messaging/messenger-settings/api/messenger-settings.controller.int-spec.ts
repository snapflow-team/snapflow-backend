import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../../../../libs/common/constants/global-prefix.constant';
import { AccessTokenTestHelper } from '../../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';

describe('MessengerSettingsController (Integration)', () => {
  let appTestManager: AppTestManager;
  let accessTokenTestHelper: AccessTokenTestHelper;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    const apiSettings = appTestManager
      .getApp()
      .get(ConfigService<Configuration, true>)
      .get<ApiSettings>('apiSettings');
    const jwtService = new JwtService({ secret: apiSettings.accessTokenSecret });

    accessTokenTestHelper = new AccessTokenTestHelper(jwtService);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  describe('PATCH /messenger/settings/activity-status', () => {
    it('должен сохранить showActivityStatus=false и вернуть 204', async () => {
      await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/settings/activity-status`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ showActivityStatus: false })
        .expect(204);

      const settings = await appTestManager.prisma.userPresenceSettings.findUnique({
        where: { userId: 1 },
      });

      expect(settings).toEqual(
        expect.objectContaining({
          userId: 1,
          showActivityStatus: false,
        }),
      );
    });

    it('должен включить обратно showActivityStatus=true', async () => {
      await appTestManager.prisma.userPresenceSettings.create({
        data: {
          userId: 1,
          showActivityStatus: false,
        },
      });

      await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/settings/activity-status`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ showActivityStatus: true })
        .expect(204);

      const settings = await appTestManager.prisma.userPresenceSettings.findUnique({
        where: { userId: 1 },
      });

      expect(settings?.showActivityStatus).toBe(true);
    });

    it('должен вернуть 400 при отсутствии showActivityStatus', async () => {
      await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/settings/activity-status`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({})
        .expect(400);
    });
  });
});

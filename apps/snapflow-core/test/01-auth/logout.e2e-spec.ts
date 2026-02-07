import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import { AuthTestManager } from '../managers/auth.test-manager';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import { HttpStatus } from '@nestjs/common';
import { Session } from '@generated/prisma';

describe('AuthController - logout() (POST: /auth/logout)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    authTestManager = new AuthTestManager(appTestManager.prisma, server);

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['migrations']);

    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен успешно разлогинить пользователя и очистить refreshToken cookie при валидном JWT refresh и сессии в БД', async () => {
    const { refreshToken } = await authTestManager.loginAndGetRefreshCookie();

    const resLogout: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(HttpStatus.NO_CONTENT);

    // проверяем, что в ответе нет тела
    expect(resLogout.body).toEqual({});

    // проверяем, что в Set-Cookie уходит clear-cookie для refreshToken
    expect(resLogout.headers['set-cookie']).toBeDefined();

    const cookie: string = resLogout.headers['set-cookie'][0];
    expect(cookie).toMatch(/refreshToken=/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/);

    // проверяем, что сессия помечена как удалённая в БД
    const sessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: { not: null } },
    });

    expect(sessions.length).toBe(1);
    expect(sessions[0].deviceId).toBeDefined();
  });
});

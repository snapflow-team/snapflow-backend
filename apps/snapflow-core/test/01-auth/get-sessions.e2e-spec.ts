import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { Server } from 'http';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';

describe('SessionsController - getAllSessions() (GET: /sessions)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let user: UserWithEmailConfirmation;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    authTestManager = new AuthTestManager(appTestManager.prisma, server);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);

    const [registeredUser] = await authTestManager.registrationWithConfirmation();
    user = registeredUser;
    agent = request.agent(server);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен возвращать сессии', async () => {
    await agent
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({ email: user.email, password: 'Qwerty_1' })
      .expect(HttpStatus.OK);

    const response = await agent.get(`/${GLOBAL_PREFIX}/sessions`).expect(HttpStatus.OK);

    expect(response.body).toHaveLength(1);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceId: expect.any(String),
          deviceName: expect.any(String),
          ip: expect.any(String),
          lastVisit: expect.any(String),
        }),
      ]),
    );
  });
  it('должен выкинуть 401 елси пользователь не авторизован', async () => {
    await agent
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({ email: user.email, password: 'Qwerty_1' })
      .expect(HttpStatus.OK);
  });

  it('должен возвращать две разные сессии при повторном логине', async () => {
    await agent
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({ email: user.email, password: 'Qwerty_1' })
      .expect(HttpStatus.OK);

    const response1 = await agent.get(`/${GLOBAL_PREFIX}/sessions`).expect(HttpStatus.OK);
    expect(response1.body).toHaveLength(1);

    await agent
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .set('User-Agent', 'Mobile-App')
      .send({ email: user.email, password: 'Qwerty_1' })
      .expect(HttpStatus.OK);

    const response2 = await agent.get(`/${GLOBAL_PREFIX}/sessions`).expect(HttpStatus.OK);

    expect(response2.body).toHaveLength(2);
    expect(response2.body[0].deviceId).not.toBe(response2.body[1].deviceId);
  });
});

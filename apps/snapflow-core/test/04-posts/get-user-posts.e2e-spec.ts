import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { PostTestManager } from '../managers/post.test-manager';

describe('PostsController - getProfilePosts() (GET: /posts/user/:userId)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let postTestManager: PostTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);
    postTestManager = new PostTestManager(appTestManager.prisma);

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();

    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  function getUserPosts(
    userId: number,
    query: { cursor?: string; limit?: number } = {},
  ) {
    return request(server)
      .get(`/${GLOBAL_PREFIX}/posts/user/${userId}`)
      .query(query);
  }

  it('должен вернуть пустой список, если у пользователя нет опубликованных постов', async () => {
    const {
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    const res: Response = await getUserPosts(userId).expect(HttpStatus.OK);

    expect(res.body).toEqual({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  it('должен вернуть следующую страницу по nextCursor без дубликатов', async () => {
    const {
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    await postTestManager.createPublishedPost(userId, [], 10);

    const page1: Response = await getUserPosts(userId, { limit: 8 }).expect(HttpStatus.OK);

    expect(page1.body.items).toHaveLength(8);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2: Response = await getUserPosts(userId, {
      cursor: page1.body.nextCursor,
      limit: 8,
    }).expect(HttpStatus.OK);

    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.hasMore).toBe(false);
    expect(page2.body.nextCursor).toBeNull();

    const page1Ids = page1.body.items.map((item: { id: string }) => item.id);
    const page2Ids = page2.body.items.map((item: { id: string }) => item.id);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  it('не должен возвращать черновики (DRAFT)', async () => {
    const {
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    await postTestManager.createPublishedPost(userId, [], 1);
    await postTestManager.createDraftPost(userId, [], 1);

    const res: Response = await getUserPosts(userId).expect(HttpStatus.OK);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe('PUBLISHED');
  });

  it('должен вернуть 400 BAD_REQUEST при невалидном cursor', async () => {
    const {
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    const res: Response = await getUserPosts(userId, {
      cursor: 'not-a-valid-cursor',
    }).expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/user/${userId}?cursor=not-a-valid-cursor`,
      method: 'GET',
      message: 'Validation failed',
      code: SnapFlowDomainExceptionCode.ValidationError,
      extensions: [{ field: 'cursor', message: 'Invalid cursor' }],
    });
  });
});

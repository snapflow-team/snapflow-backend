import { Server } from 'http';
import request, { Response } from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/emails/templates/types';
import { ProfileTestManager } from '../managers/profile.test-manager';
import { UserProfile } from '@generated/prisma-snapflow';
import {
  PublicProfileViewDto
} from '../../src/modules/user-accounts/users/profile/api/dto/view-dto/public-profile.view-dto';
import { PostTestManager } from '../managers/post.test-manager';

describe('ProfileController - getPublicProfile() (GET: /users/profile/:profileId)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let profileTestManager: ProfileTestManager;
  let postTestManager: PostTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);
    profileTestManager = new ProfileTestManager(appTestManager.prisma, server);
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

  it('должен успешно вернуть публичный профиль по ID без передачи токена (эндпоинт @Public)', async () => {
    // 🔻 1. Регистрируем пользователя
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    const profile: UserProfile | null = await appTestManager.prisma.userProfile.findFirst({
      where: { userId },
    });

    // 🔻 Обновляем профиль
    const updateDto = {
      username: 'updatedUsername',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2000-01-01',
      country: 'Germany',
      city: 'Berlin',
      aboutMe: 'Backend developer',
    };

    await profileTestManager.updateProfile(accessToken, updateDto);

    // 🔻 3. Делаем GET запрос
    const response: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${profile!.id}`)
      .expect(HttpStatus.OK);

    // 🔻 4. Проверяем точное соответствие возвращаемой структуры PublicProfileViewDto
    expect(response.body).toEqual<PublicProfileViewDto>({
      id: profile!.id.toString(),
      username: updateDto.username,
      avatarUrl: null,
      aboutMe: updateDto.aboutMe,
      userMetadata: {
        followingCount: 0,
        followersCount: 0,
        publicationsCount: 0,
      },
    });
  });

  it('должен успешно вернуть публичный профиль по ID и корректно посчитать количество опубликованных постов постов', async () => {
    // 🔻 1. Регистрируем пользователя
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 2. Создаем посты
    await postTestManager.createPublishedPost(userId, [], 5);

    const profile: UserProfile | null = await appTestManager.prisma.userProfile.findFirst({
      where: { userId },
    });

    // 🔻 3. Обновляем профиль
    const updateDto = {
      username: 'updatedUsername',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2000-01-01',
      country: 'Germany',
      city: 'Berlin',
      aboutMe: 'Backend developer',
    };

    await profileTestManager.updateProfile(accessToken, updateDto);

    // 🔻 4. Делаем GET запрос
    const response: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${profile!.id}`)
      .expect(HttpStatus.OK);

    // 🔻 5. Проверяем точное соответствие возвращаемой структуры PublicProfileViewDto
    expect(response.body).toEqual<PublicProfileViewDto>({
      id: profile!.id.toString(),
      username: updateDto.username,
      avatarUrl: null,
      aboutMe: updateDto.aboutMe,
      userMetadata: {
        followingCount: 0,
        followersCount: 0,
        publicationsCount: 5,
      },
    });
  });

  it('не должен учитывать в publicationsCount посты, которые были удалены (deletedAt != null)', async () => {
    // 🔻 1. Регистрируем пользователя
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 2. Создаем 5 постов (метод ничего не возвращает)
    await postTestManager.createPublishedPost(userId, [], 5);

    // 🔻 3. Достаем 2 любых поста этого пользователя из БД напрямую
    const postsToDelete = await appTestManager.prisma.post.findMany({
      where: { userId },
      take: 2,
    });

    const postIdsToDelete = postsToDelete.map((post) => post.id);

    // Помечаем эти 2 поста как удаленные (soft delete)
    await appTestManager.prisma.post.updateMany({
      where: {
        id: { in: postIdsToDelete },
      },
      data: {
        deletedAt: new Date(),
      },
    });

    const profile: UserProfile | null = await appTestManager.prisma.userProfile.findFirst({
      where: { userId },
    });

    // 🔻 4. Обновляем профиль
    const updateDto = {
      username: 'updatedUsername',
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1995-05-05',
      country: 'France',
      city: 'Paris',
      aboutMe: 'Testing soft deletes',
    };

    await profileTestManager.updateProfile(accessToken, updateDto);

    // 🔻 5. Делаем GET запрос для получения профиля
    const response: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${profile!.id}`)
      .expect(HttpStatus.OK);

    // 🔻 6. Проверяем, что вернулось 3 поста, а не 5 (так как 2 были удалены)
    expect(response.body).toEqual<PublicProfileViewDto>({
      id: profile!.id.toString(),
      username: updateDto.username,
      avatarUrl: null,
      aboutMe: updateDto.aboutMe,
      userMetadata: {
        followingCount: 0,
        followersCount: 0,
        publicationsCount: 3, // 5 создали - 2 удалили = 3
      },
    });
  });

  it.only('не должен учитывать в publicationsCount черновики постов (status = DRAFT)', async () => {
    // 🔻 1. Регистрируем пользователя
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 2. Создаем 5 опубликованных постов (метод ничего не возвращает)
    await postTestManager.createPublishedPost(userId, [], 5);

    // 🔻 2. Создаем 1 черновик поста (метод ничего не возвращает)
    await postTestManager.createDraftPost(userId, [], 1);

    const profile: UserProfile | null = await appTestManager.prisma.userProfile.findFirst({
      where: { userId },
    });

    // 🔻 4. Обновляем профиль
    const updateDto = {
      username: 'updatedUsername',
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1995-05-05',
      country: 'France',
      city: 'Paris',
      aboutMe: 'Testing soft deletes',
    };

    await profileTestManager.updateProfile(accessToken, updateDto);

    // 🔻 5. Делаем GET запрос для получения профиля
    const response: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${profile!.id}`)
      .expect(HttpStatus.OK);

    // 🔻 6. Проверяем, что вернулось 5 поста, а не 6 (так как 1 черновик)
    expect(response.body).toEqual<PublicProfileViewDto>({
      id: profile!.id.toString(),
      username: updateDto.username,
      avatarUrl: null,
      aboutMe: updateDto.aboutMe,
      userMetadata: {
        followingCount: 0,
        followersCount: 0,
        publicationsCount: 5,
      },
    });
  });

  it('должен вернуть 404 NOT_FOUND, если профиль с указанным ID не существует', async () => {
    const fakeProfileId = 999999;

    await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${fakeProfileId}`)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('должен вернуть 404 NOT_FOUND, если профиль пользователя был удален (soft-delete)', async () => {
    // 🔻 1. Регистрируем пользователя
    const {
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    const profile: UserProfile | null = await appTestManager.prisma.userProfile.findFirst({
      where: { userId },
    });

    // 🔻 2. Помечаем профиль как удаленный
    await appTestManager.prisma.userProfile.update({
      where: { id: profile!.id },
      data: { deletedAt: new Date() },
    });

    // 🔻 3. Пытаемся запросить профиль по ID
    await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${profile!.id}`)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('должен вернуть 400 BAD_REQUEST, если передан невалидный ID профиля (не число)', async () => {
    // В контроллере используется ParseIntPipe, который должен отбить не-числа
    const invalidProfileId = 'not-a-number';

    await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${invalidProfileId}`)
      .expect(HttpStatus.BAD_REQUEST);
  });
});

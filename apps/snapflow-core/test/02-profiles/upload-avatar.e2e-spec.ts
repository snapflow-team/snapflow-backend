import { Server } from 'http';
import request, { Response } from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthTestManager } from '../managers/auth.test-manager';
import { AppTestManager } from '../managers/app.test-manager';
import { TestUtils } from '../helpers/test.utils';

import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth.constants';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { UploadFileResponse } from '../../../../libs/contracts/files';
import { FilesClient } from '../../src/modules/integrations/files/files.client';
import { EmailService } from '../../src/modules/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/emails/templates/types';
import { AVATAR_IMAGE_SIZE } from '../../../../libs/common/constants/image-size.constants';
import { ProfileTestManager } from '../managers/profile.test-manager';
import { ProfileViewDto } from '../../src/modules/user-accounts/users/profile/api/dto/view-dto/profile.view-dto';

// 🔻 Фейковые буферы для имитации загрузки файлов
const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const validJpegBuffer = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);
const invalidPdfBuffer = Buffer.from('JVBERi0xLjQKJcOkw7zDtsOfCg==', 'base64');
// Буфер размером чуть больше 10MB (предполагая, что лимит 10MB)
const tooLargeBuffer = Buffer.alloc(11 * 1024 * 1024, 'a');

describe('ProfileController - uploadAvatar() (POST: /users/profile/avatar)', () => {
  let appTestManager: AppTestManager;
  let profileTestManager: ProfileTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let uploadFileMock: jest.Mock;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder.overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: (userAccountsConfig: UserAccountsConfig) => {
          return new JwtService({
            secret: userAccountsConfig.accessTokenSecret,
            signOptions: { expiresIn: '2s' },
          });
        },
        inject: [UserAccountsConfig],
      }),
    );

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);
    profileTestManager = new ProfileTestManager(appTestManager.prisma, server);

    uploadFileMock = jest.spyOn(FilesClient.prototype, 'uploadFile').mockResolvedValue({
      key: 'avatars/fake-uuid.png',
      publicUrl: 'https://s3.fake-domain.com/avatars/fake-uuid.png',
    } as UploadFileResponse) as jest.Mock;

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();

    uploadFileMock.mockClear();
    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен успешно загрузить PNG аватар и вернуть ссылку при валидных данных', async () => {
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();
    const expectedUrl = 'https://s3.fake-domain.com/avatars/fake-uuid.png';

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('avatar', validPngBuffer, 'avatar.png')
      .expect(HttpStatus.CREATED);

    // Проверяем структуру ответа (AvatarViewDto)
    expect(res.body).toEqual({
      publicUrl: expectedUrl,
    });

    // Проверяем, что URL сохранился в таблице профиля
    const profile: ProfileViewDto = await profileTestManager.findProfileByUserId(userId);
    expect(profile.avatarUrl).toBe(expectedUrl);

    // Проверяем, что запрос действительно ушел в микросервис
    expect(uploadFileMock).toHaveBeenCalled();
    expect(uploadFileMock).toHaveBeenCalledTimes(1);

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('должен успешно загрузить JPEG/JPG аватар при валидных данных', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    await request(server)
      .post(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('avatar', validJpegBuffer, 'avatar.jpg')
      .expect(HttpStatus.CREATED);

    expect(uploadFileMock).toHaveBeenCalledTimes(1);

    // Проверяем, что запрос действительно ушел в микросервис
    expect(uploadFileMock).toHaveBeenCalled();
    expect(uploadFileMock).toHaveBeenCalledTimes(1);

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не должен загружать аватар и должен вернуть 401, если accessToken не передан', async () => {
    await request(server)
      .post(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .attach('avatar', validPngBuffer, 'avatar.png')
      .expect(HttpStatus.UNAUTHORIZED);

    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('не должен загружать аватар и должен вернуть 401, если accessToken невалиден', async () => {
    await request(server)
      .post(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', 'Bearer invalid.token.here')
      .attach('avatar', validPngBuffer, 'avatar.png')
      .expect(HttpStatus.UNAUTHORIZED);

    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('не должен загружать аватар и должен вернуть 401, если accessToken протух', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    // Ждем истечения токена (согласно нашему моку JWT это 2 секунды)
    await TestUtils.delay(3000);

    await request(server)
      .post(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('avatar', validPngBuffer, 'avatar.png')
      .expect(HttpStatus.UNAUTHORIZED);

    expect(uploadFileMock).not.toHaveBeenCalled();

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не должен загружать аватар и должен вернуть 400 (Validation Error), если файл вообще не передан', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/users/profile/avatar`,
      method: 'POST',
      message: 'Validation failed',
      code: SnapFlowDomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'avatar',
          message: expect.stringContaining('File is required'),
        },
      ],
    });

    expect(uploadFileMock).not.toHaveBeenCalled();

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не должен загружать аватар и должен вернуть 400, если файл отправлен с неверным ключом (например image вместо avatar)', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    await request(server)
      .post(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('image', validPngBuffer, 'avatar.png')
      .expect(HttpStatus.BAD_REQUEST);

    expect(uploadFileMock).not.toHaveBeenCalled();

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не должен загружать аватар и должен вернуть 400, если формат файла не поддерживается (например PDF)', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('avatar', invalidPdfBuffer, 'document.pdf')
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/users/profile/avatar`,
      method: 'POST',
      message: 'Validation failed',
      code: SnapFlowDomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'avatar',
          message: expect.stringMatching(
            /Validation failed \(current file type is application\/pdf, expected type is.*jpeg.*png/,
          ),
        },
      ],
    });

    expect(uploadFileMock).not.toHaveBeenCalled();

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не должен загружать аватар и должен вернуть 400, если размер файла превышает лимит', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('avatar', tooLargeBuffer, 'huge.png')
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/users/profile/avatar`,
      method: 'POST',
      message: 'Validation failed',
      code: SnapFlowDomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'avatar',
          message: `Validation failed (current file size is ${tooLargeBuffer.byteLength}, expected size is less than ${AVATAR_IMAGE_SIZE})`,
        },
      ],
    });

    expect(uploadFileMock).not.toHaveBeenCalled();

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});

import { PrismaService } from '../../../../../database/prisma.service';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SnapflowCoreModule } from '../../../../../snapflow-core.module';
import { GoogleAuthGuard } from '../../domain/guards/google/google-auth.guard';
import request from 'supertest';
import { UsersRepository } from '../../../users/infrastructure/users.repository';

describe('Google OAuth', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;

  const mockGoogleUser = {
    email: 'email@email.com',
    providerId: 'google-1234',
    name: 'Google-Name',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SnapflowCoreModule],
    })
      .overrideGuard(GoogleAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockGoogleUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    usersRepository = moduleFixture.get<UsersRepository>(UsersRepository);

    await app.init();
  });

  beforeAll(async () => {
    await prisma.user.deleteMany();
  });

  beforeEach(async () => {
    // Очищаем таблицы в правильном порядке (сначала дочерние, потом родительские)
    // Если у вас есть таблицы OAuthAccount или Session, их тоже надо чистить
    await prisma.authAccount.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/google/callback создать юзера и перенаправить на фронт', async () => {
    const response = await request(app.getHttpServer()).get('/auth/google/callback').expect(302); // Ждем редирект

    const cookies = response.get('Set-Cookie') || [];
    expect(cookies.some((c) => c.includes('refreshToken'))).toBeTruthy();

    expect(response.header.location).toBe('https://snapflow.cc/main');

    const user = await usersRepository.findUserByEmail(mockGoogleUser.email);
    expect(user).toBeDefined();
    expect(user?.email).toBe(mockGoogleUser.email);
  });

  it('GET /auth/google/callback если адрес совпадает, должна быть ссылка на существующего пользователя', async () => {
    await usersRepository.createUser({
      email: mockGoogleUser.email,
      username: 'already-exists',
      password: 'some-password-hash',
    });

    const response = await request(app.getHttpServer()).get('/auth/google/callback').expect(302);

    const authAccount = await usersRepository.findAccountByProvider(
      mockGoogleUser.providerId,
      'GOOGLE',
    );
    expect(authAccount).toBeDefined();
    expect(authAccount?.userId).toBeDefined();
  });
});

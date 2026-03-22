import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs'; // Для мока Axios
import { RevalidateOnPostCreatedEventHandler } from './revalidate-on-post-created.event-handler';
import { NextjsRevalidationService } from '../nextjs-revalidation.service';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { CryptoService } from '../../../../../../../libs/common/services/crypto.service';
import { NextjsEndpoints } from '../constants/nextjs-endpoints';

describe('RevalidateOnPostCreatedEventHandler (Integration)', () => {
  let module: TestingModule;
  let eventHandler: RevalidateOnPostCreatedEventHandler;
  let httpServicePostMock: jest.Mock;

  // Внутреннее состояние нашего мокового Redis
  let mockRedisStore: Record<string, number> = {};

  const mockRedisClient = {
    incr: jest.fn().mockImplementation(async (key: string) => {
      if (!mockRedisStore[key]) mockRedisStore[key] = 0;
      mockRedisStore[key] += 1;
      return mockRedisStore[key];
    }),
    set: jest.fn().mockImplementation(async (key: string, value: any) => {
      mockRedisStore[key] = Number(value);
      return 'OK';
    }),
  };

  const mockCryptoService = {
    generateJwtToken: jest.fn().mockReturnValue('mocked_jwt_token'),
  };

  beforeAll(async () => {
    httpServicePostMock = jest.fn().mockReturnValue(of({ data: 'ok' })); // Возвращаем успешный Observable

    module = await Test.createTestingModule({
      providers: [
        RevalidateOnPostCreatedEventHandler,
        NextjsRevalidationService,
        {
          provide: REDIS_CLIENT_INJECT_TOKEN,
          useValue: mockRedisClient,
        },
        {
          provide: HttpService,
          useValue: { post: httpServicePostMock },
        },
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'apiSettings') {
                return {
                  nextjsRevalidationSecret: 'secret',
                  baseFrontUrl: 'https://front.mock.com',
                  nextjsRevalidationTokenExpiresIn: '1h',
                };
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    eventHandler = module.get<RevalidateOnPostCreatedEventHandler>(
      RevalidateOnPostCreatedEventHandler,
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Очищаем "Redis" перед каждым тестом
    mockRedisStore = { 'revalidate:posts_count': 0 };
    httpServicePostMock.mockReturnValue(of({ data: 'ok' }));
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Позитивные сценарии', () => {
    it('должен только инкрементировать счетчик в Redis, если создано менее 4 постов (запрос на ревалидацию НЕ отправляется)', async () => {
      // 1. Устанавливаем счетчик в 1
      mockRedisStore['revalidate:posts_count'] = 1;

      // 2. Вызываем обработчик события
      await eventHandler.handle();

      // 3. Проверяем, что счетчик увеличился до 2
      expect(mockRedisClient.incr).toHaveBeenCalledWith('revalidate:posts_count');
      expect(mockRedisStore['revalidate:posts_count']).toBe(2);

      // 4. Проверяем, что запрос на фронт НЕ улетел
      expect(httpServicePostMock).not.toHaveBeenCalled();
      expect(mockCryptoService.generateJwtToken).not.toHaveBeenCalled();
    });

    it('должен отправить HTTP-запрос на ревалидацию и обнулить Redis, если это 4-й созданный пост', async () => {
      // 1. Устанавливаем счетчик в 3 (следующий пост будет 4-м)
      mockRedisStore['revalidate:posts_count'] = 3;

      await eventHandler.handle();

      // 3. Проверяем, что счетчик инкрементировался
      expect(mockRedisClient.incr).toHaveBeenCalledWith('revalidate:posts_count');

      // 4. Проверяем, что токен сгенерирован и HTTP-запрос улетел на правильный URL
      expect(mockCryptoService.generateJwtToken).toHaveBeenCalledTimes(1);
      expect(httpServicePostMock).toHaveBeenCalledTimes(1);
      expect(httpServicePostMock).toHaveBeenCalledWith(
        `https://front.mock.com${NextjsEndpoints.Revalidate}`,
        {},
        { headers: { Authorization: 'Bearer mocked_jwt_token' } },
      );

      // 5. Проверяем, что счетчик в Redis сброшен на 0
      expect(mockRedisClient.set).toHaveBeenCalledWith('revalidate:posts_count', 0);
      expect(mockRedisStore['revalidate:posts_count']).toBe(0);
    });
  });

  describe('Негативные сценарии', () => {
    it('не должен падать (перехватывать ошибку), если HTTP-запрос на Next.js фронтенд завершился ошибкой', async () => {
      // 1. Подготавливаем 4-й пост, чтобы триггернуть запрос
      mockRedisStore['revalidate:posts_count'] = 3;

      // Настраиваем axios так, чтобы он выкинул ошибку сети
      httpServicePostMock.mockReturnValueOnce(throwError(() => new Error('Next.js is down')));

      // 2. Обработчик не должен прокидывать ошибку наверх (приложение не должно падать)
      await expect(eventHandler.handle()).resolves.not.toThrow();

      // 3. Убеждаемся, что попытка отправить запрос была
      expect(httpServicePostMock).toHaveBeenCalledTimes(1);

      // 4. Проверяем, что сброс в 0 НЕ вызывался (так как вернулся false)
      expect(mockRedisClient.set).not.toHaveBeenCalled();

      // 5. Счетчик должен остаться на значении 4 (так как мы сделали incr, но не сделали set 0)
      expect(mockRedisStore['revalidate:posts_count']).toBe(4);
    });
  });
});

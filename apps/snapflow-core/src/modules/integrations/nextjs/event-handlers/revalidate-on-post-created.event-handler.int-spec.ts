import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { of, throwError } from 'rxjs';
import { RevalidateOnPostCreatedEventHandler } from './revalidate-on-post-created.event-handler';
import { RevalidateOnNewSignupEventHandler } from './revalidate-on-new-signup.event-handler';
import { NextjsRevalidationService } from '../nextjs-revalidation.service';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { CryptoService } from '../../../../../../../libs/common/services/crypto.service';
import { NextjsEndpoints } from '../constants/nextjs-endpoints';
import { LoggerFactory } from '../../../logger/logger.factory';
import { HomeRevalidationCountersStore } from '../infrastructure/home-revalidation-counters.store';
import {
  RecordHomeRevalidationActivityCommand,
  RecordHomeRevalidationActivityUseCase,
} from '../application/record-home-revalidation-activity-usecase';
import {
  HOME_REVALIDATION_REDIS_KEYS,
  HomeRevalidationActivitySource,
} from '../constants/home-revalidation.constants';

const REVALIDATE_URL = `https://front.mock.com${NextjsEndpoints.Revalidate}`;

describe('Home revalidation (Integration)', () => {
  let module: TestingModule;
  let postEventHandler: RevalidateOnPostCreatedEventHandler;
  let signupEventHandler: RevalidateOnNewSignupEventHandler;
  let commandBus: CommandBus;
  let httpServicePostMock: jest.Mock;

  let mockRedisStore: Record<string, number> = {};

  const mockRedisClient = {
    incr: jest.fn().mockImplementation(async (key: string) => {
      if (!mockRedisStore[key]) mockRedisStore[key] = 0;
      mockRedisStore[key] += 1;
      return mockRedisStore[key];
    }),
    get: jest.fn().mockImplementation(async (key: string) => {
      const value = mockRedisStore[key];

      return value === undefined ? null : String(value);
    }),
    set: jest.fn().mockImplementation(async (key: string, value: unknown) => {
      mockRedisStore[key] = Number(value);
      return 'OK';
    }),
  };

  const mockCryptoService = {
    generateJwtToken: jest.fn().mockReturnValue('mocked_jwt_token'),
  };

  beforeAll(async () => {
    httpServicePostMock = jest.fn().mockReturnValue(of({ data: 'ok' }));

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        RevalidateOnPostCreatedEventHandler,
        RevalidateOnNewSignupEventHandler,
        NextjsRevalidationService,
        HomeRevalidationCountersStore,
        RecordHomeRevalidationActivityUseCase,
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
        {
          provide: LoggerFactory,
          useValue: {
            create: jest.fn().mockReturnValue({
              log: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    await module.init();

    postEventHandler = module.get(RevalidateOnPostCreatedEventHandler);
    signupEventHandler = module.get(RevalidateOnNewSignupEventHandler);
    commandBus = module.get(CommandBus);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisStore = {
      [HOME_REVALIDATION_REDIS_KEYS.posts]: 0,
      [HOME_REVALIDATION_REDIS_KEYS.signups]: 0,
    };
    httpServicePostMock.mockReturnValue(of({ data: 'ok' }));
  });

  afterAll(async () => {
    await module.close();
  });

  const expectRevalidationRequest = () => {
    expect(mockCryptoService.generateJwtToken).toHaveBeenCalledTimes(1);
    expect(httpServicePostMock).toHaveBeenCalledTimes(1);
    expect(httpServicePostMock).toHaveBeenCalledWith(
      REVALIDATE_URL,
      {},
      { headers: { Authorization: 'Bearer mocked_jwt_token' } },
    );
  };

  const expectBothCountersReset = () => {
    expect(mockRedisClient.set).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.posts, 0);
    expect(mockRedisClient.set).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.signups, 0);
    expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(0);
    expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(0);
  };

  describe('RevalidateOnPostCreatedEventHandler', () => {
    it('должен только инкрементировать счётчик постов, если создано менее 4 постов', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 1;

      await postEventHandler.handle();

      expect(mockRedisClient.incr).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.posts);
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(2);
      expect(httpServicePostMock).not.toHaveBeenCalled();
      expect(mockCryptoService.generateJwtToken).not.toHaveBeenCalled();
    });

    it('должен отправить HTTP на /api/revalidate-home и обнулить оба счётчика при 4-м посте', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 3;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 2;

      await postEventHandler.handle();

      expect(mockRedisClient.incr).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.posts);
      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('не должен сбрасывать счётчики, если HTTP-запрос завершился ошибкой', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 3;
      httpServicePostMock.mockReturnValueOnce(throwError(() => new Error('Next.js is down')));

      await expect(postEventHandler.handle()).resolves.not.toThrow();

      expect(httpServicePostMock).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(4);
    });
  });

  describe('RevalidateOnNewSignupEventHandler', () => {
    it('должен только инкрементировать счётчик регистраций, если создано менее 5 регистраций', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 2;

      await signupEventHandler.handle();

      expect(mockRedisClient.incr).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.signups);
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(3);
      expect(httpServicePostMock).not.toHaveBeenCalled();
      expect(mockCryptoService.generateJwtToken).not.toHaveBeenCalled();
    });

    it('должен отправить HTTP на /api/revalidate-home и обнулить оба счётчика при 5-й регистрации', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 4;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 3;

      await signupEventHandler.handle();

      expect(mockRedisClient.incr).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.signups);
      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('не должен сбрасывать счётчики, если HTTP-запрос завершился ошибкой', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 4;
      httpServicePostMock.mockReturnValueOnce(throwError(() => new Error('Next.js is down')));

      await expect(signupEventHandler.handle()).resolves.not.toThrow();

      expect(httpServicePostMock).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(5);
    });
  });

  describe('RecordHomeRevalidationActivityUseCase (OR threshold)', () => {
    it('должен триггерить ревалидацию по порогу регистраций, даже если постов меньше 4', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 1;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 4;

      await commandBus.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
      );

      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('должен триггерить ревалидацию по порогу постов, даже если регистраций меньше 5', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 3;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 1;

      await commandBus.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
      );

      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('не должен триггерить ревалидацию, пока оба счётчика ниже порогов', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 2;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 3;

      await commandBus.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
      );

      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(3);
      expect(httpServicePostMock).not.toHaveBeenCalled();
    });
  });
});

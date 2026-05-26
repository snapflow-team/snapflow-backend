import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { CryptoService } from '../../../../../../../libs/common/services/crypto.service';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { Configuration } from '../../../../setup/configuration/configuration';
import { NextjsEndpoints } from '../constants/nextjs-endpoints';
import {
  HOME_REVALIDATION_REDIS_KEYS,
  HOME_REVALIDATION_THRESHOLDS,
  HomeRevalidationActivitySource,
} from '../constants/home-revalidation.constants';
import {
  RecordHomeRevalidationActivityCommand,
  RecordHomeRevalidationActivityUseCase,
} from './record-home-revalidation-activity-usecase';

describe('RecordHomeRevalidationActivityUseCase (Интеграционные тесты)', () => {
  let useCase: RecordHomeRevalidationActivityUseCase;
  let testHelper: IntTestHelper;
  let httpServicePostMock: jest.Mock;
  let generateJwtTokenSpy: jest.SpyInstance;
  let revalidateUrl: string;
  let mockRedisStore: Record<string, number> = {};

  const mockRedisClient = {
    incr: jest.fn().mockImplementation(async (key: string) => {
      if (mockRedisStore[key] === undefined) {
        mockRedisStore[key] = 0;
      }
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

  const resetRedisStore = () => {
    Object.keys(mockRedisStore).forEach((key) => delete mockRedisStore[key]);
    mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 0;
    mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 0;
  };

  beforeAll(async () => {
    httpServicePostMock = jest.fn().mockReturnValue(of({ data: 'ok' }));

    testHelper = new IntTestHelper();
    await testHelper.createTestingModule([
      {
        provide: REDIS_CLIENT_INJECT_TOKEN,
        useValue: mockRedisClient,
      },
      {
        provide: HttpService,
        useValue: { post: httpServicePostMock },
      },
    ]);

    useCase = testHelper.get(RecordHomeRevalidationActivityUseCase);
    generateJwtTokenSpy = jest.spyOn(testHelper.get(CryptoService), 'generateJwtToken');

    const configService = testHelper.get<ConfigService<Configuration, true>>(ConfigService);
    const apiSettings = configService.get<ApiSettings>('apiSettings');
    revalidateUrl = `${apiSettings.baseFrontUrl}${NextjsEndpoints.Revalidate}`;
  });

  afterAll(async () => {
    generateJwtTokenSpy.mockRestore();
    await testHelper.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetRedisStore();
    httpServicePostMock.mockReturnValue(of({ data: 'ok' }));
  });

  const expectRevalidationRequest = () => {
    expect(generateJwtTokenSpy).toHaveBeenCalledWith(
      { action: 'revalidate_home' },
      expect.any(String),
      expect.anything(),
    );
    expect(httpServicePostMock).toHaveBeenCalledTimes(1);
    expect(httpServicePostMock).toHaveBeenCalledWith(
      revalidateUrl,
      {},
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
  };

  const expectNoRevalidation = () => {
    expect(httpServicePostMock).not.toHaveBeenCalled();
    expect(generateJwtTokenSpy).not.toHaveBeenCalled();
  };

  const expectBothCountersReset = () => {
    expect(mockRedisClient.set).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.posts, 0);
    expect(mockRedisClient.set).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.signups, 0);
    expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(0);
    expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(0);
  };

  describe('source: post', () => {
    it('(Success) должен инкрементировать счётчик постов без ревалидации, пока порог не достигнут', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 1;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
      );

      expect(mockRedisClient.incr).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.posts);
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(2);
      expectNoRevalidation();
    });

    it('(Success) должен накапливать счётчик постов при нескольких вызовах', async () => {
      for (let i = 0; i < HOME_REVALIDATION_THRESHOLDS.posts - 1; i += 1) {
        await useCase.execute(
          new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
        );
      }

      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(
        HOME_REVALIDATION_THRESHOLDS.posts - 1,
      );
      expectNoRevalidation();
    });

    it('(Success) должен инкрементировать только posts и читать signups без инкремента', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 2;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 3;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
      );

      expect(mockRedisClient.incr).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.posts);
      expect(mockRedisClient.incr).not.toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.signups);
      expect(mockRedisClient.get).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.signups);
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(3);
    });

    it('(Success) должен вызвать ревалидацию и обнулить оба счётчика на 4-м посте', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] =
        HOME_REVALIDATION_THRESHOLDS.posts - 1;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 2;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
      );

      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('(Success) должен вызвать ревалидацию по порогу постов при малом числе регистраций', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] =
        HOME_REVALIDATION_THRESHOLDS.posts - 1;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 1;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
      );

      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('(Success) должен вызвать ревалидацию по OR, если регистрации уже достигли порога', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 1;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] =
        HOME_REVALIDATION_THRESHOLDS.signups;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
      );

      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('(Success) не должен сбрасывать счётчики при ошибке HTTP', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] =
        HOME_REVALIDATION_THRESHOLDS.posts - 1;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 3;
      httpServicePostMock.mockReturnValueOnce(throwError(() => new Error('Next.js is down')));

      await expect(
        useCase.execute(
          new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
        ),
      ).resolves.not.toThrow();

      expect(httpServicePostMock).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(
        HOME_REVALIDATION_THRESHOLDS.posts,
      );
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(3);
    });
  });

  describe('source: signup', () => {
    it('(Success) должен инкрементировать счётчик регистраций без ревалидации, пока порог не достигнут', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 2;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
      );

      expect(mockRedisClient.incr).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.signups);
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(3);
      expectNoRevalidation();
    });

    it('(Success) должен накапливать счётчик регистраций при нескольких вызовах', async () => {
      for (let i = 0; i < HOME_REVALIDATION_THRESHOLDS.signups - 1; i += 1) {
        await useCase.execute(
          new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
        );
      }

      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(
        HOME_REVALIDATION_THRESHOLDS.signups - 1,
      );
      expectNoRevalidation();
    });

    it('(Success) должен инкрементировать только signups и читать posts без инкремента', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 2;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 3;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
      );

      expect(mockRedisClient.incr).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.signups);
      expect(mockRedisClient.incr).not.toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.posts);
      expect(mockRedisClient.get).toHaveBeenCalledWith(HOME_REVALIDATION_REDIS_KEYS.posts);
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(3);
    });

    it('(Success) должен вызвать ревалидацию и обнулить оба счётчика на 5-й регистрации', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] =
        HOME_REVALIDATION_THRESHOLDS.signups - 1;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 3;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
      );

      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('(Success) должен вызвать ревалидацию по порогу регистраций при малом числе постов', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] =
        HOME_REVALIDATION_THRESHOLDS.signups - 1;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 1;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
      );

      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('(Success) должен вызвать ревалидацию по OR, если посты уже достигли порога', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 1;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] =
        HOME_REVALIDATION_THRESHOLDS.posts;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
      );

      expectRevalidationRequest();
      expectBothCountersReset();
    });

    it('(Success) не должен сбрасывать счётчики при ошибке HTTP', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] =
        HOME_REVALIDATION_THRESHOLDS.signups - 1;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 3;
      httpServicePostMock.mockReturnValueOnce(throwError(() => new Error('Next.js is down')));

      await expect(
        useCase.execute(
          new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
        ),
      ).resolves.not.toThrow();

      expect(httpServicePostMock).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(
        HOME_REVALIDATION_THRESHOLDS.signups,
      );
      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(3);
    });
  });

  describe('пороги OR', () => {
    it('(Success) не должен вызывать ревалидацию, пока оба счётчика ниже порогов (post)', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 2;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 3;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
      );

      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts]).toBe(3);
      expectNoRevalidation();
    });

    it('(Success) не должен вызывать ревалидацию, пока оба счётчика ниже порогов (signup)', async () => {
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.posts] = 2;
      mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups] = 3;

      await useCase.execute(
        new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
      );

      expect(mockRedisStore[HOME_REVALIDATION_REDIS_KEYS.signups]).toBe(4);
      expectNoRevalidation();
    });
  });
});

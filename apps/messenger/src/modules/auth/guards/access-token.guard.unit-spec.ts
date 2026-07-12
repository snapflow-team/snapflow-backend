import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '../../../common/exceptions/domain-exceptions';
import { LoggerFactory } from '../../logger/logger.factory';
import { AuthTokenService } from '../application/services/auth-token.service';
import { AccessTokenGuard } from './access-token.guard';

describe('AccessTokenGuard (unit)', () => {
  const secret = 'access-token-secret';
  let guard: AccessTokenGuard;
  let signAccessToken: (userId: number, expiresIn?: '1h' | '-1s') => string;

  const createContext = (authorization?: string): ExecutionContext => {
    const request: { headers: { authorization?: string }; user?: { id: number } } = {
      headers: {},
    };

    if (authorization !== undefined) {
      request.headers.authorization = authorization;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  beforeEach(() => {
    const jwtService = new JwtService({ secret });
    signAccessToken = (userId: number, expiresIn: '1h' | '-1s' = '1h') =>
      jwtService.sign({ userId }, { expiresIn });

    const loggerFactoryMock = {
      create: () => ({
        warn: jest.fn(),
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
      }),
    } as unknown as LoggerFactory;

    guard = new AccessTokenGuard(new AuthTokenService(jwtService), loggerFactoryMock);
  });

  it('должен вернуть 401 без authorization header', () => {
    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(createContext())).toThrow('Missing authorization header');
  });

  it('должен вернуть 401 при невалидном Bearer-формате', () => {
    expect(() => guard.canActivate(createContext('Token abc'))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(createContext('Token abc'))).toThrow('Invalid or expired token');
  });

  it('должен вернуть 401 при невалидном access token', () => {
    expect(() => guard.canActivate(createContext('Bearer invalid-token'))).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(createContext('Bearer invalid-token'))).toThrow(
      'Invalid or expired token',
    );
  });

  it('должен вернуть 401 при истёкшем access token', () => {
    const expiredToken = signAccessToken(1, '-1s');

    expect(() => guard.canActivate(createContext(`Bearer ${expiredToken}`))).toThrow(
      UnauthorizedException,
    );
  });

  it('должен пропустить запрос и установить request.user при валидном access token', () => {
    const token = signAccessToken(42);
    const context = createContext(`Bearer ${token}`);

    expect(guard.canActivate(context)).toBe(true);
    expect(context.switchToHttp().getRequest()).toEqual(
      expect.objectContaining({
        user: { id: 42 },
      }),
    );
  });
});

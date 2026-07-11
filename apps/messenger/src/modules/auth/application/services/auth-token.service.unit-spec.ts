import { JwtService } from '@nestjs/jwt';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  const userId = 42;
  const secret = 'access-token-secret';

  function createService(): AuthTokenService {
    return new AuthTokenService(new JwtService({ secret }));
  }

  it('должен верифицировать access token', () => {
    const service = createService();
    const token = new JwtService({ secret }).sign({ userId }, { expiresIn: '1h' });

    const payload = service.verifyAndDecodeAccessToken(token);

    expect(payload.userId).toBe(userId);
    expect(payload.iat).toEqual(expect.any(Number));
    expect(payload.exp).toEqual(expect.any(Number));
  });

  it('должен выбрасывать ошибку для невалидного token', () => {
    const service = createService();

    expect(() => service.verifyAndDecodeAccessToken('invalid-token')).toThrow();
  });
});

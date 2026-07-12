import { JwtService } from '@nestjs/jwt';

type AccessTokenExpiresIn = '1h' | '1s' | '-1s';

export class AccessTokenTestHelper {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(userId: number, expiresIn: AccessTokenExpiresIn = '1h'): string {
    return this.jwtService.sign({ userId }, { expiresIn });
  }

  signExpiredAccessToken(userId: number): string {
    return this.signAccessToken(userId, '-1s');
  }

  signAccessTokenExpiringInSeconds(userId: number, secondsFromNow: number): string {
    const exp = Math.floor(Date.now() / 1000) + secondsFromNow;

    return this.jwtService.sign({ userId, exp });
  }
}

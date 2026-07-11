import { Module } from '@nestjs/common';
import { AuthTokenService } from './application/services/auth-token.service';
import { AccessTokenProvider } from './providers/access-token.provider';

@Module({
  providers: [AuthTokenService, AccessTokenProvider],
  exports: [AuthTokenService],
})
export class JwtAuthModule {}

import { Module } from '@nestjs/common';
import { AuthTokenService } from './application/services/auth-token.service';
import { AccessTokenProvider } from './providers/access-token.provider';
import { RefreshTokenProvider } from './providers/refresh-token.provider';

//Этот модуль предназачается для шеринга некоторых jwt провайдеров не только в user accounts module, но и в notification module
@Module({
  imports: [],
  providers: [AuthTokenService, AccessTokenProvider, RefreshTokenProvider],
  exports: [AuthTokenService],
})
export class JwtAuthModule {}

import { Module } from '@nestjs/common';
import { AuthTokenService } from './services/auth-token.service';
import { AccessTokenProvider } from './providers/access-token.provider';
import { AccessTokenGuard } from './guards/access-token.guard';

@Module({
  providers: [AuthTokenService, AccessTokenProvider, AccessTokenGuard],
  exports: [AuthTokenService, AccessTokenGuard],
})
export class StorageJwtAuthModule {}

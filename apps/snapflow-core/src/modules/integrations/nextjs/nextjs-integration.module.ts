import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NextjsRevalidationService } from './nextjs-revalidation.service';
import { RevalidateOnPostCreatedEventHandler } from './event-handlers/revalidate-on-post-created.event-handler';
import { CryptoService } from '../../../../../../libs/common/services/crypto.service';

@Module({
  imports: [HttpModule],
  providers: [NextjsRevalidationService, RevalidateOnPostCreatedEventHandler, CryptoService],
})
export class NextjsIntegrationModule {}

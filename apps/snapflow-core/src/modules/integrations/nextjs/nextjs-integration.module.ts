import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NextjsRevalidationService } from './nextjs-revalidation.service';
import { RevalidateOnPostCreatedEventHandler } from './event-handlers/revalidate-on-post-created.event-handler';

@Module({
  imports: [HttpModule],
  providers: [NextjsRevalidationService, RevalidateOnPostCreatedEventHandler],
})
export class NextjsIntegrationModule {}

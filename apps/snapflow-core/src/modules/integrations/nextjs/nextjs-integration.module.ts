import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NextjsRevalidationService } from './nextjs-revalidation.service';
import { RevalidateOnPostCreatedEventHandler } from './event-handlers/revalidate-on-post-created.event-handler';
import { RevalidateOnNewSignupEventHandler } from './event-handlers/revalidate-on-new-signup.event-handler';
import { CryptoService } from '../../../../../../libs/common/services/crypto.service';
import { HomeRevalidationCountersStore } from './infrastructure/home-revalidation-counters.store';
import { RecordHomeRevalidationActivityUseCase } from './application/record-home-revalidation-activity-usecase';

@Module({
  imports: [HttpModule],
  providers: [
    NextjsRevalidationService,
    HomeRevalidationCountersStore,
    RecordHomeRevalidationActivityUseCase,
    RevalidateOnPostCreatedEventHandler,
    RevalidateOnNewSignupEventHandler,
    CryptoService,
  ],
})
export class NextjsIntegrationModule {}

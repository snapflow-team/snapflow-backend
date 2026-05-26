import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HomeRevalidationCountersStore } from '../infrastructure/home-revalidation-counters.store';
import { NextjsRevalidationService } from '../nextjs-revalidation.service';
import {
  HOME_REVALIDATION_THRESHOLDS,
  HomeRevalidationActivitySource,
} from '../constants/home-revalidation.constants';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';

export class RecordHomeRevalidationActivityCommand {
  constructor(public readonly source: HomeRevalidationActivitySource) {}
}

@CommandHandler(RecordHomeRevalidationActivityCommand)
export class RecordHomeRevalidationActivityUseCase
  implements ICommandHandler<RecordHomeRevalidationActivityCommand>
{
  private readonly logger: ContextLogger;

  constructor(
    private readonly countersStore: HomeRevalidationCountersStore,
    private readonly revalidationService: NextjsRevalidationService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(RecordHomeRevalidationActivityUseCase.name);
  }

  async execute({ source }: RecordHomeRevalidationActivityCommand): Promise<void> {
    const { postsCount, signupsCount } = await this.incrementAndReadCounts(source);

    this.logActivity(source, postsCount, signupsCount);

    const shouldRevalidate: boolean =
      postsCount >= HOME_REVALIDATION_THRESHOLDS.posts ||
      signupsCount >= HOME_REVALIDATION_THRESHOLDS.signups;

    if (!shouldRevalidate) {
      return;
    }

    const isSuccess: boolean = await this.revalidationService.triggerRevalidation();

    if (isSuccess) {
      await this.countersStore.resetBoth();
    }
  }

  private async incrementAndReadCounts(
    source: HomeRevalidationActivitySource,
  ): Promise<{ postsCount: number; signupsCount: number }> {
    if (source === HomeRevalidationActivitySource.Post) {
      const postsCount: number = await this.countersStore.incrementPosts();
      const signupsCount: number = await this.countersStore.getSignupsCount();

      return { postsCount, signupsCount };
    }

    const signupsCount: number = await this.countersStore.incrementSignups();
    const postsCount: number = await this.countersStore.getPostsCount();

    return { postsCount, signupsCount };
  }

  private logActivity(
    source: HomeRevalidationActivitySource,
    postsCount: number,
    signupsCount: number,
  ): void {
    if (source === HomeRevalidationActivitySource.Post) {
      this.logger.log(`New post created. Current un-revalidated count: ${postsCount}`);

      return;
    }

    this.logger.log(`New signup. Current un-revalidated count: ${signupsCount}`);
  }
}

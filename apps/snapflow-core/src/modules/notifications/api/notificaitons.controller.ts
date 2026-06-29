import { Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ExtractUserFromRequest } from '../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { GetNotificationsQueryParamsDto } from './input/get-notifications-query-params.dto';
import { NotificationsPageViewDto } from './output/notificaitonss-page-view.dto';
import { GetNotificationsQuery } from '../application/queries/get-notificaitons.query';
import { GetUnreadNotificationsCountQuery } from '../application/queries/get-notifications-count.query';
import { UnreadNotificationsCountViewDto } from './output/unread-notifications-count.view-dto';
import { MarkAllNotificationsReadCommand } from '../application/use-cases/mark-all-notificaitons-read.use-case';
import { GetNotificationsSwagger } from './swagger/get-notifications.swagger';
import { GetUnreadNotificationsCountSwagger } from './swagger/get-notifications-unread-count.swagger';
import { MarkAllNotificationsReadSwagger } from './swagger/mark-all-read.swagger';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @GetNotificationsSwagger()
  async getNotifications(
    @Query() query: GetNotificationsQueryParamsDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<NotificationsPageViewDto> {
    return this.queryBus.execute<GetNotificationsQuery, NotificationsPageViewDto>(
      new GetNotificationsQuery(userId, query),
    );
  }

  @Get('unread-count')
  @GetUnreadNotificationsCountSwagger()
  async getUnreadCount(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<UnreadNotificationsCountViewDto> {
    return this.queryBus.execute<GetUnreadNotificationsCountQuery, UnreadNotificationsCountViewDto>(
      new GetUnreadNotificationsCountQuery(userId),
    );
  }

  @Post('mark-all-read')
  @MarkAllNotificationsReadSwagger()
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@ExtractUserFromRequest() { id: userId }: UserContextDto): Promise<void> {
    await this.commandBus.execute<MarkAllNotificationsReadCommand, void>(
      new MarkAllNotificationsReadCommand(userId),
    );
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { ExtractClientInfo } from '../../user-accounts/auth/decorators/request/extract-client-info.decorator';
import { ClientInfoDto } from '../../../../../../libs/common/dto/client-info.dto';
import { Configuration } from '../../../setup/configuration/configuration';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { SavePushSubscriptionInputDto } from './input/save-push-subscription.input-dto';
import { DeletePushSubscriptionInputDto } from './input/delete-push-subscription.input-dto';
import { VapidPublicKeyViewDto } from './output/vapid-public-key.view-dto';
import { SavePushSubscriptionCommand } from '../application/use-cases/save-push-subscription.use-case';
import { DeletePushSubscriptionCommand } from '../application/use-cases/delete-push-subscription.use-case';
import { GetVapidPublicKeySwagger } from './swagger/get-vapid-public-key.swagger';
import { SavePushSubscriptionSwagger } from './swagger/save-push-subscription.swagger';
import { DeletePushSubscriptionSwagger } from './swagger/delete-push-subscription.swagger';

@Controller('notifications/push-subscriptions')
@UseGuards(JwtAuthGuard)
export class PushSubscriptionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  @Get('vapid-public-key')
  @GetVapidPublicKeySwagger()
  getVapidPublicKey(): VapidPublicKeyViewDto {
    const { vapidPublicKey }: ApiSettings = this.configService.get<ApiSettings>('apiSettings');

    return { publicKey: vapidPublicKey };
  }

  @Post()
  @SavePushSubscriptionSwagger()
  @HttpCode(HttpStatus.CREATED)
  async savePushSubscription(
    @Body() { endpoint, keys }: SavePushSubscriptionInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @ExtractClientInfo() { userAgent }: ClientInfoDto,
  ): Promise<void> {
    await this.commandBus.execute<SavePushSubscriptionCommand, void>(
      new SavePushSubscriptionCommand({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      }),
    );
  }

  @Delete()
  @DeletePushSubscriptionSwagger()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePushSubscription(
    @Body() { endpoint }: DeletePushSubscriptionInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute<DeletePushSubscriptionCommand, void>(
      new DeletePushSubscriptionCommand({ userId, endpoint }),
    );
  }
}

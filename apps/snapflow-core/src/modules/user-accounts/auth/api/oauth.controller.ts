import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ExtractUserFromRequest } from '../domain/guards/decorators/extract-user-from-request.decorator';
import { ExtractClientInfo } from '../../../../../../../libs/common/decorators/request/extract-client-info.decorator';
import { ClientInfoDto } from '../../../../../../../libs/common/dto/client-info.dto';
import type { Response } from 'express';
import { UserAccountsConfig } from '../../config/user-accounts.config';
import { CommandBus } from '@nestjs/cqrs';
import { BASE_URL } from '../constants/auth-tokens.inject-constants';

@ApiTags('OAuth')
@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly userAccountsConfig: UserAccountsConfig,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('github')
  @UseGuards(GithubAuthGuard)
  async githubAuth() {}

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  async githubCallback(
    @ExtractUserFromRequest() user: GithubContextDto,
    @ExtractClientInfo() clientInfo: ClientInfoDto,
    @Res() res: Response,
  ) {
    const { refreshToken } = await this.commandBus.execute(
      new AuthGithubCommand(user, clientInfo.ip, clientInfo.userAgent),
    );

    res.cookie('refreshToken', refreshToken, this.userAccountsConfig.getCookieConfig());
    res.redirect(`${BASE_URL}`);
  }
}

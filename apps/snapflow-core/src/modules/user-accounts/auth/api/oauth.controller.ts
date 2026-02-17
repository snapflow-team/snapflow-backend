import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ExtractUserFromRequest } from '../domain/guards/decorators/extract-user-from-request.decorator';
import { ExtractClientInfo } from '../../../../../../../libs/common/decorators/request/extract-client-info.decorator';
import { ClientInfoDto } from '../../../../../../../libs/common/dto/client-info.dto';
import type { Response } from 'express';
import { UserAccountsConfig } from '../../config/user-accounts.config';
import { CommandBus } from '@nestjs/cqrs';
import { BASE_URL } from '../constants/auth-tokens.inject-constants';
import { GithubAuthGuard } from '../domain/guards/github/github-auth.guard';
import { AuthTokens } from '../domain/types/auth-tokens.type';
import { OAuthCommand } from '../application/usecases/oauth.usecase';
import { OAuthContextDto } from '../domain/guards/dto/oauth-context.dto';
import { GoogleAuthGuard } from '../domain/guards/google/google-auth.guard';
import { GoogleSwagger } from './swagger/google.swagger';
import { GoogleCallbackSwagger } from './swagger/google-callback.swagger';

@ApiTags('OAuth')
@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly userAccountsConfig: UserAccountsConfig,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @GoogleSwagger()
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @GoogleCallbackSwagger()
  async googleCallback(
    @ExtractUserFromRequest() profile: OAuthContextDto,
    @ExtractClientInfo() clientInfo: ClientInfoDto,
    @Res() res: Response,
  ) {
    const { refreshToken }: AuthTokens = await this.commandBus.execute(
      new OAuthCommand({
        provider: profile.provider,
        providerAccountId: profile.id,
        email: profile.email,
        username: profile.username,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      }),
    );

    res.cookie('refreshToken', refreshToken, this.userAccountsConfig.getCookieConfig());
    res.redirect(`${BASE_URL}`);
  }

  @Get('github')
  @UseGuards(GithubAuthGuard)
  async githubAuth() {}

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  async githubCallback(
    @ExtractUserFromRequest() profile: OAuthContextDto,
    @ExtractClientInfo() clientInfo: ClientInfoDto,
    @Res() res: Response,
  ) {
    const { refreshToken }: AuthTokens = await this.commandBus.execute(
      new OAuthCommand({
        provider: profile.provider,
        providerAccountId: profile.id,
        email: profile.email,
        username: profile.username,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      }),
    );

    res.cookie('refreshToken', refreshToken, this.userAccountsConfig.getCookieConfig());
    res.redirect(`${BASE_URL}`);
  }
}

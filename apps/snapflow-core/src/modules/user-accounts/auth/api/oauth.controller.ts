import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ExtractUserFromRequest } from '../domain/guards/decorators/extract-user-from-request.decorator';
import { ExtractClientInfo } from '../decorators/request/extract-client-info.decorator';
import { ClientInfoDto } from '../../../../../../../libs/common/dto/client-info.dto';
import type { Response } from 'express';
import { CommandBus } from '@nestjs/cqrs';
import { GithubAuthGuard } from '../domain/guards/github/github-auth.guard';
import { AuthTokens } from '../domain/types/auth-tokens.type';
import { OAuthCommand } from '../application/usecases/oauth.usecase';
import { OAuthContextDto } from '../domain/guards/dto/oauth-context.dto';
import { GoogleAuthGuard } from '../domain/guards/google/google-auth.guard';
import { GoogleAuthSwagger } from './swagger/google-auth.swagger';
import { GoogleCallbackSwagger } from './swagger/google-callback.swagger';
import { GithubAuthSwagger } from './swagger/github-auth.swagger';
import { GithubCallbackSwagger } from './swagger/github-callback.swagger';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';

@ApiTags('OAuth')
@Controller('oauth')
export class OAuthController {
  private apiSettings: ApiSettings;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly commandBus: CommandBus,
  ) {
    this.apiSettings = this.configService.get<ApiSettings>('apiSettings');
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @GoogleAuthSwagger()
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

    res.cookie('refreshToken', refreshToken, this.apiSettings.getCookieOptions());
    res.redirect(`${this.apiSettings.baseFrontUrl}`);
  }

  @Get('github')
  @UseGuards(GithubAuthGuard)
  @GithubAuthSwagger()
  async githubAuth() {}

  //todo(vitaliy) необходимо типизировать все квери и комманды в контроллерах
  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  @GithubCallbackSwagger()
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

    res.cookie('refreshToken', refreshToken, this.apiSettings.getCookieOptions());
    res.redirect(`${this.apiSettings.baseFrontUrl}`);
  }
}

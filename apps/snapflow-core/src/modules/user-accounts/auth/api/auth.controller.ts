import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { RegistrationUserInputDto } from './input-dto/registration-user.input-dto';
import { CommandBus } from '@nestjs/cqrs';
import { RegisterUserCommand } from '../application/usecases/register-user.useсase';
import { ApiTags } from '@nestjs/swagger';
import { ApiRegistration } from './swagger/registration.swagger';
import { LocalAuthGuard } from '../domain/guards/local/local-auth.guard';
import { ExtractUserFromRequest } from '../domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../domain/guards/dto/user-context.dto';
import { ExtractClientInfo } from '../../../../../../../libs/common/decorators/request/extract-client-info.decorator';
import { ClientInfoDto } from '../../../../../../../libs/common/dto/client-info.dto';
import { LoginViewDto } from './view-dto/login.view-dto';
import { AuthTokens } from '../domain/types/auth-tokens.type';
import { LoginUserCommand } from '../application/usecases/login-user.usecase';
import type { Response } from 'express';
import { UserAccountsConfig } from '../../config/user-accounts.config';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly userAccountsConfig: UserAccountsConfig,
    private readonly commandBus: CommandBus,
  ) {}
  @Post('registration')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiRegistration()
  async registration(@Body() body: RegistrationUserInputDto): Promise<void> {
    await this.commandBus.execute(new RegisterUserCommand(body));
  }

  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(LocalAuthGuard)
  async login(
    @ExtractUserFromRequest() user: UserContextDto,
    @ExtractClientInfo() clientInfo: ClientInfoDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginViewDto> {
    const { accessToken, refreshToken }: AuthTokens = await this.commandBus.execute(
      new LoginUserCommand({
        userId: user.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      }),
    );

    res.cookie('refreshToken', refreshToken, this.userAccountsConfig.getCookieConfig());

    return { accessToken };
  }
}

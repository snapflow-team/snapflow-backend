import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { RegistrationUserInputDto } from './input-dto/registration-user.input-dto';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
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
import { ConfirmationEmailCodeInputDto } from './input-dto/confirmation-email-code.input-dto';
import { ConfirmationEmailCommand } from '../application/usecases/confirmation-email.usecase';
import { ConfirmRegistrationSwagger } from './swagger/confirm-registration.swagger';
import { UserAccountsConfig } from '../../config/user-accounts.config';
import { LoginSwagger } from './swagger/login.swagger';
import { JwtRefreshAuthGuard } from '../domain/guards/bearer/jwt-refresh-auth.guard';
import { ExtractSessionFromRequest } from '../domain/guards/decorators/extract-session-from-request.decorator';
import { SessionContextDto } from '../domain/guards/dto/session-context.dto';
import { LogoutCommand } from '../application/usecases/logout.usecase';
import { LogoutSwagger } from './swagger/logout.swagger';
import { RegistrationEmailResendingInputDto } from './input-dto/registration-email-resending.input-dto';
import { RegistrationEmailResendingCommand } from '../application/usecases/registration-email-resending.usecase';
import { PasswordRecoveryCommand } from '../application/usecases/password-recovery.usecase';
import { PasswordRecoveryInputDto } from './input-dto/password-recovery.input-dto';
import { ApiPasswordRecovery } from './swagger/password-recovery.swagger';
import { ApiRegisterEmailResendingCommand } from './swagger/registration-email-resending.swagger';
import { NewPasswordInputDto } from './input-dto/new-password.input-dto';
import { NewPasswordCommand } from '../application/usecases/new-password.usecase';
import { JwtAuthGuard } from '../domain/guards/bearer/jwt-auth.guard';
import { MeViewDto } from './view-dto/me.view-dto';
import { GetMeQuery } from '../application/queries/get-me.query-handler';
import { ApiMe } from './swagger/me.swagger';
import { ApiNewPassword } from './swagger/new-password.swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly userAccountsConfig: UserAccountsConfig,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}
  @Post('registration')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiRegistration()
  async registration(@Body() body: RegistrationUserInputDto): Promise<void> {
    await this.commandBus.execute(new RegisterUserCommand(body));
  }

  @Post('registration-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ConfirmRegistrationSwagger()
  async confirmRegistration(@Body() body: ConfirmationEmailCodeInputDto): Promise<void> {
    await this.commandBus.execute(new ConfirmationEmailCommand(body.code));
  }

  @Post('registration-email-resending')
  @ApiRegisterEmailResendingCommand()
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendingEmail(@Body() body: RegistrationEmailResendingInputDto): Promise<void> {
    await this.commandBus.execute(new RegistrationEmailResendingCommand(body.email));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @LoginSwagger()
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

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtRefreshAuthGuard)
  @LogoutSwagger()
  async logout(
    @ExtractSessionFromRequest() session: SessionContextDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.commandBus.execute(new LogoutCommand(session));

    const { httpOnly, secure, sameSite } = this.userAccountsConfig.getCookieConfig();

    res.clearCookie('refreshToken', {
      httpOnly,
      secure,
      sameSite,
    });
  }

  @Post('password-recovery')
  @ApiPasswordRecovery()
  @HttpCode(HttpStatus.NO_CONTENT)
  async passwordRecovery(@Body() body: PasswordRecoveryInputDto) {
    await this.commandBus.execute(new PasswordRecoveryCommand(body.email));
  }

  @Post('new-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNewPassword()
  async newPassword(@Body() body: NewPasswordInputDto) {
    await this.commandBus.execute(new NewPasswordCommand(body.newPassword, body.recoveryCode));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiMe()
  async me(@ExtractUserFromRequest() user: UserContextDto): Promise<MeViewDto> {
    return this.queryBus.execute(new GetMeQuery(user.id));
  }
}

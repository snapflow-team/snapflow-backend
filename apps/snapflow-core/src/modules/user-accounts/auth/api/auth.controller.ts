import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RegistrationUserInputDto } from './input-dto/registration-user.input-dto';
import { RegisterUserCommand } from '../application/usecases/register-user.useсase';
import { ConfirmationEmailCodeInputDto } from './input-dto/confirmation-email-code.input-dto';
import { ConfirmationEmailCommand } from '../application/usecases/confirmation-email.usecase';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}
  @Post('registration')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registration(@Body() body: RegistrationUserInputDto): Promise<void> {
    await this.commandBus.execute(new RegisterUserCommand(body));
  }

  @Post('registration-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmRegistration(@Body() body: ConfirmationEmailCodeInputDto): Promise<void> {
    await this.commandBus.execute(new ConfirmationEmailCommand(body.code));
  }
}

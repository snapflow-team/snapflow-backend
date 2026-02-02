import { Body, Controller, Post } from '@nestjs/common';
import { RegistrationUserInputDto } from './input-dto/registration-user.input-dto';
import { CommandBus } from '@nestjs/cqrs';
import { RegisterUserCommand } from '../application/usecases/register-user.useсase';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}
  @Post('registration')
  async registration(@Body() body: RegistrationUserInputDto): Promise<void> {
    await this.commandBus.execute(new RegisterUserCommand(body));
  }
}

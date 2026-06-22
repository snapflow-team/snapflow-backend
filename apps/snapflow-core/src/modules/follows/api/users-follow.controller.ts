import { Controller, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersFollowController {
  constructor(private readonly commandBus: CommandBus) {}
}

import { Module } from '@nestjs/common';
import { UsersRepository } from './users/infrastructure/users.repository';
import { AuthController } from './auth/api/auth.controller';
import { RegisterUserUseCase } from './auth/application/usecases/register-user.useсase';
import { DateService } from '../../../../../libs/common/services/date.service';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { UserValidationService } from './users/application/services/user-validation.service';
import { NotificationsModule } from '../notifications/notifications.module';

const controllers = [AuthController];
const useCases = [RegisterUserUseCase];
const services = [DateService, CryptoService, UserValidationService];
const repositories = [UsersRepository];

@Module({
  imports: [NotificationsModule],
  controllers: [...controllers],
  providers: [...useCases, ...services, ...repositories],
  exports: [],
})
export class UserAccountsModule {}

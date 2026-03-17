import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../infrastructure/users.repository';
import { UserWithPasswordRecoveryCode } from '../../types/user-with-password-recovery.type';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { BadRequestException } from '../../../../../common/exceptions/domain-exceptions';

@Injectable()
export class UserValidationService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly dateService: DateService,
  ) {}
  async validatePasswordRecoveryCode(recoveryCode: string): Promise<UserWithPasswordRecoveryCode> {
    const user: UserWithPasswordRecoveryCode | null =
      await this.usersRepository.findUserByPasswordRecoveryCode(recoveryCode);

    if (!user || !user.passwordRecoveryCode) {
      throw new BadRequestException('Recovery code incorrect');
    }

    if (
      user.passwordRecoveryCode.expirationDate &&
      this.dateService.isExpired(user.passwordRecoveryCode.expirationDate)
    ) {
      throw new BadRequestException('Recovery code has expired');
    }

    return user;
  }
}

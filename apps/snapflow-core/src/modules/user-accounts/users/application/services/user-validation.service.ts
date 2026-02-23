import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../infrastructure/users.repository';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { UserWithPasswordRecoveryCode } from '../../types/user-with-password-recovery.type';
import { DateService } from '../../../../../../../../libs/common/services/date.service';

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
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Recovery code incorrect',
      });
    }

    if (
      user.passwordRecoveryCode.expirationDate &&
      this.dateService.isExpired(user.passwordRecoveryCode.expirationDate)
    ) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Recovery code has expired',
      });
    }

    return user;
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserContextDto } from '../dto/user-context.dto';
import { Strategy } from 'passport-local';
import { ConfirmationStatus } from '@generated/prisma';
import { DomainException } from '../../../../../../../../../libs/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../../libs/exceptions/domain-exception-codes';
import { UsersRepository } from '../../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../../../../../../../libs/common/services/crypto.service';
import { UserWithEmailConfirmation } from '../../../../users/types/user-with-confirmation.type';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
  ) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<UserContextDto> {
    const user: UserWithEmailConfirmation | null =
      await this.usersRepository.findUserByEmailWithEmailConfirmation(email);

    if (!user || !user.password) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'Invalid email or password',
      });
    }

    const isPasswordValid: boolean = await this.cryptoService.comparePassword({
      password,
      hash: user.password,
    });

    if (!isPasswordValid) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'Invalid email or password',
      });
    }

    if (
      !user.emailConfirmationCode ||
      user.emailConfirmationCode.confirmationStatus !== ConfirmationStatus.Confirmed
    ) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'The user has not verified his email',
      });
    }

    return { id: user.id };
  }
}

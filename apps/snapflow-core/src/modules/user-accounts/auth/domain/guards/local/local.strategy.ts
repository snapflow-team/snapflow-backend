import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserContextDto } from '../dto/user-context.dto';
import { Strategy } from 'passport-local';
import { User } from '@generated/prisma';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { UsersRepository } from '../../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../../../../../../../libs/common/services/crypto.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
  ) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<UserContextDto> {
    const user: User | null = await this.usersRepository.findUserByEmail(email);

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

    return { id: user.id };
  }
}

import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../infrastructure/users.repository';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import {
  ValidationErrorDetail
} from '../../../../../../../../libs/common/exceptions/interfaces/validation-error-detail.interface';
import { ValidationException } from '../../../../../../../../libs/common/exceptions/validation.exception';

@Injectable()
export class UserValidationService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
  ) {}

  async validateUniqueUser(username: string, email: string): Promise<void> {
    const errors: ValidationErrorDetail[] = [];

    const [byUsername, byEmail] = await Promise.all([
      this.usersRepository.findByUsername(username),
      this.usersRepository.findByEmail(email),
    ]);

    if (byUsername) {
      errors.push({
        field: 'username',
        message: 'User with this username is already registered',
      });
    }

    if (byEmail) {
      errors.push({
        field: 'email',
        message: 'User with this email is already registered',
      });
    }

    if (errors.length) {
      throw new ValidationException(errors);
    }
  }

  // async authenticateUser(loginOrEmail: string, password: string): Promise<UserContextDto> {
  //   let user: User | null = await this.usersRepository.getByEmail(loginOrEmail);
  //
  //   if (!user) {
  //     user = await this.usersRepository.getByLogin(loginOrEmail);
  //   }
  //
  //   if (!user) {
  //     throw new DomainException({
  //       code: DomainExceptionCode.Unauthorized,
  //       message: 'Invalid username or password',
  //     });
  //   }
  //
  //   const isPasswordValid: boolean = await this.cryptoService.comparePassword({
  //     password,
  //     hash: user.passwordHash,
  //   });
  //
  //   if (!isPasswordValid) {
  //     throw new DomainException({
  //       code: DomainExceptionCode.Unauthorized,
  //       message: 'Invalid username or password',
  //     });
  //   }
  //
  //   return { id: user.id };
  // }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { UsersRepository } from '../../infrastructure/users.repository';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { ValidationErrorDetail } from '../../../../../../../../libs/common/exceptions/interfaces/validation-error-detail.interface';
import { ValidationException } from '../../../../../../../../libs/common/exceptions/validation.exception';
import { User } from '../../../../../../generated/prisma';
import { UserContextDto } from '../../../auth/domain/guards/dto/user-context.dto';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../libs/common/exceptions/error-codes.enum';

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

  async authenticateUser(email: string, password: string): Promise<UserContextDto> {
    const user: User | null = await this.usersRepository.findByEmail(email);

    if (!user) {
      throw new DomainException(
        ErrorCodes.UNAUTHORIZED,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isPasswordValid: boolean = await this.cryptoService.comparePassword({
      password,
      hash: user.password,
    });

    if (!isPasswordValid) {
      throw new DomainException(
        ErrorCodes.UNAUTHORIZED,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return { id: user.id };
  }
}

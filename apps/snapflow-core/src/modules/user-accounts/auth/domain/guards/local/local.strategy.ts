import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserValidationService } from '../../../../users/application/services/user-validation.service';
import { UserContextDto } from '../dto/user-context.dto';
import { Strategy } from 'passport-local';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly userValidationService: UserValidationService) {
    super({ usernameField: 'email' });
  }

  async validate(username: string, password: string): Promise<UserContextDto> {
    return await this.userValidationService.authenticateUser(username, password);
  }
}

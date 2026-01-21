import { CreateUserEntityDto } from './dto/create-user.entity.dto';

export class User {
  login: string;
  email: string;
  passwordHash: string;

  static create(dto: CreateUserEntityDto): User {
    const user = new this();
    user.login = dto.login;
    user.email = dto.email;
    user.passwordHash = dto.passwordHash;
    return user;
  }
}

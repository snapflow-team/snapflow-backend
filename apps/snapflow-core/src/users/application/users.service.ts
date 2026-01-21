import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../infrastructure/users.repository';

@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

  findOne(id: string) {
    return this.usersRepository.getMockUser(id);
  }
}

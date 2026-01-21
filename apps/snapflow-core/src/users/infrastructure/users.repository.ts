import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersRepository {
  constructor() {}

  getMockUser(id: string): string {
    return `some mock user with ${id} data`;
  }
}

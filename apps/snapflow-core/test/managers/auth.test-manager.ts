import { PrismaService } from '../../src/database/prisma.service';
import { User } from '../../generated/prisma';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import {
  RegistrationUserInputDto
} from '../../src/modules/user-accounts/auth/api/input-dto/registration-user.input-dto';

export class AuthTestManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly server: Server,
  ) {}

  async registration(inputDtos: RegistrationUserInputDto[] = [], count: number = 1): Promise<void> {
    const dtos: RegistrationUserInputDto[] =
      inputDtos.length > 0 ? inputDtos : TestDtoFactory.generateRegistrationUserInputDto(count);

    const registrationPromises: Promise<Response>[] = [];

    for (let i = 0; i < dtos.length; i++) {
      registrationPromises.push(
        request(this.server)
          .post(`/${GLOBAL_PREFIX}/auth/registration`)
          .send(dtos[i])
          .expect(HttpStatus.NO_CONTENT),
      );
    }

    await Promise.all(registrationPromises);
  }

  async getAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }
}

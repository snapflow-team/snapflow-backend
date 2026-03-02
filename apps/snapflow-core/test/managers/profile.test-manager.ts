import { PrismaService } from '../../src/database/prisma.service';
import { Server } from 'http';
import { ProfileViewDto } from '../../src/modules/user-accounts/users/profile/api/dto/view-dto/profile.view-dto';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { UpdateProfileInputDto } from '../../src/modules/user-accounts/users/profile/api/dto/input-dto/update-profile.input-dto';

export class ProfileTestManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly server: Server,
  ) {}

  async findProfileByUserId(userId: number): Promise<ProfileViewDto> {
    const res: Response = await request(this.server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${userId.toString()}`)
      .expect(HttpStatus.OK);

    return res.body as ProfileViewDto;
  }

  async updateProfile(
    accessToken: string,
    updateData?: Partial<UpdateProfileInputDto>,
  ): Promise<void> {
    const dto: UpdateProfileInputDto = {
      username: 'john_123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2000-01-01',
      country: 'Germany',
      city: 'Berlin',
      aboutMe: 'Backend developer',
      ...updateData,
    };

    await request(this.server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.NO_CONTENT);
  }
}

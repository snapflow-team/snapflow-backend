import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { MeViewDto } from '../../auth/api/view-dto/me.view-dto';
import { RawUserForMe } from './types/raw-user-for-me';
import { ErrorCodes } from '../../../../../../../libs/common/exceptions/error-codes.enum';
import { DomainException } from '../../../../../../../libs/common/exceptions/damain.exception';

@Injectable()
export class UsersQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async me(id: number): Promise<MeViewDto> {
    const user: RawUserForMe | null = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (!user) {
      throw new DomainException(
        ErrorCodes.USER_NOT_FOUND,
        `The user with ID (${id}) does not exist`,
        HttpStatus.NOT_FOUND,
      );
    }

    return MeViewDto.mapToView(user);
  }
}

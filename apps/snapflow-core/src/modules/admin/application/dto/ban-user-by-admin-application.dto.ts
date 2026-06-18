import { UserBanReason } from '../../domain/enums/user-ban-reason.enum';

export class BanUserByAdminApplicationDto {
  constructor(
    public readonly userId: number,
    public readonly reason: UserBanReason,
    public readonly customReason?: string,
  ) {}
}

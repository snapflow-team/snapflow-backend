import { ValidationException } from '../../../../../../../libs/exceptions/core';
import { UserBanReason } from '../../domain/enums/user-ban-reason.enum';

const USER_BAN_REASON_TEXT: Record<Exclude<UserBanReason, UserBanReason.AnotherReason>, string> = {
  [UserBanReason.BadBehavior]: 'Bad behavior',
  [UserBanReason.AdvertisingPlacement]: 'Advertising placement',
};

const CUSTOM_REASON_MAX_LENGTH = 500;

export function resolveBanReasonText(reason: UserBanReason, customReason?: string): string {
  if (reason === UserBanReason.AnotherReason) {
    const trimmedCustomReason: string | undefined = customReason?.trim();

    if (!trimmedCustomReason) {
      throw new ValidationException([
        { field: 'customReason', message: 'Custom reason is required' },
      ]);
    }

    if (trimmedCustomReason.length > CUSTOM_REASON_MAX_LENGTH) {
      throw new ValidationException([
        {
          field: 'customReason',
          message: `Custom reason must be at most ${CUSTOM_REASON_MAX_LENGTH} characters`,
        },
      ]);
    }

    return trimmedCustomReason;
  }

  return USER_BAN_REASON_TEXT[reason];
}

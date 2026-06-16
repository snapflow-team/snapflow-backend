import { User } from '@generated/prisma-snapflow';
import {
  ForbiddenException,
  UnauthorizedException,
} from '../../../../../common/exceptions/domain-exceptions';

export const AUTH_BLOCKED_MESSAGE = 'Account is blocked';

export function assertAuthUserActive(user: User | null): asserts user is User {
  if (!user || user.deletedAt) {
    throw new UnauthorizedException('User is not authenticated');
  }

  if (user.isBanned) {
    throw new ForbiddenException(
      `The account has been blocked for the following reason: ${user.banReason ?? 'The reason for blocking is not specified, please contact support.'}`,
    );
  }
}

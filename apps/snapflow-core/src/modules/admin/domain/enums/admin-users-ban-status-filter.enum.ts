import { registerEnumType } from '@nestjs/graphql';

export enum AdminUsersBanStatusFilter {
  NotSelected = 'NotSelected',
  Blocked = 'Blocked',
  NotBlocked = 'NotBlocked',
}

registerEnumType(AdminUsersBanStatusFilter, {
  name: 'AdminUsersBanStatusFilter',
});

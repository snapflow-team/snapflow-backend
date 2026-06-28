import { registerEnumType } from '@nestjs/graphql';

export enum AdminUsersSortField {
  Username = 'username',
  CreatedAt = 'createdAt',
}

registerEnumType(AdminUsersSortField, {
  name: 'AdminUsersSortField',
});

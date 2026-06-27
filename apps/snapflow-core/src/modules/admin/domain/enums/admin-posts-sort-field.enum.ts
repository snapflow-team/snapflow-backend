import { registerEnumType } from '@nestjs/graphql';

export enum AdminPostsSortField {
  Username = 'username',
  CreatedAt = 'createdAt',
}

registerEnumType(AdminPostsSortField, {
  name: 'AdminPostsSortField',
});

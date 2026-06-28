import { registerEnumType } from '@nestjs/graphql';

export enum AdminSortDirection {
  Ascending = 'asc',
  Descending = 'desc',
}

registerEnumType(AdminSortDirection, {
  name: 'AdminSortDirection',
});

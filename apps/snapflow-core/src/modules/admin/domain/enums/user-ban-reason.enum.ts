import { registerEnumType } from '@nestjs/graphql';

export enum UserBanReason {
  BadBehavior = 'BadBehavior',
  AdvertisingPlacement = 'AdvertisingPlacement',
  AnotherReason = 'AnotherReason',
}

registerEnumType(UserBanReason, {
  name: 'UserBanReason',
});

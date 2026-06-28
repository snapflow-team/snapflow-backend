import { PUB_SUB } from '../constants/pub-sub-provider.constant';
import { PubSub } from 'graphql-subscriptions';
import { Provider } from '@nestjs/common';

export const pubSubProvider: Provider<PubSub> = {
  provide: PUB_SUB,
  useValue: new PubSub(),
};

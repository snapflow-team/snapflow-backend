import { INestApplication, RequestMethod } from '@nestjs/common';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { ADMIN_GRAPHQL_PATH } from './admin-graphql.module-options';

export function globalPrefixSetup(app: INestApplication) {
  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: [{ path: ADMIN_GRAPHQL_PATH.replace(/^\//, ''), method: RequestMethod.ALL }],
  });
}

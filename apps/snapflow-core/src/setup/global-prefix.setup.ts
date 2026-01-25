import { INestApplication } from '@nestjs/common';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';

export function globalPrefixSetup(app: INestApplication) {
  app.setGlobalPrefix(GLOBAL_PREFIX);
}

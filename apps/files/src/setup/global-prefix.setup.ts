import { INestApplication } from '@nestjs/common';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';

// todo: вынести в либу
export function globalPrefixSetup(app: INestApplication) {
  app.setGlobalPrefix(GLOBAL_PREFIX);
}

import { Module } from '@nestjs/common';
import { UserAccountsConfig } from './user-accounts.config';

//todo: временное решение! переписать конфигурацию приложения!!!!!
@Module({
  providers: [UserAccountsConfig],
  exports: [UserAccountsConfig],
})
export class UserAccountsConfigModule {}

import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SERVICES } from '../../../../../../libs/contracts/services.tokens';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../setup/configuration/configuration';
import { ExternalServicesSettings } from '../../../setup/configuration/external-services-settings';
import { FilesClient } from './files.client';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: SERVICES.FILES,
        inject: [ConfigService],
        useFactory: (config: ConfigService<Configuration, true>) => {
          const { host, port } = config
            .get<ExternalServicesSettings>('externalServicesSettings')
            .getFilesServiceOptions();

          return {
            transport: Transport.TCP,
            options: {
              host,
              port,
            },
          };
        },
      },
    ]),
  ],
  providers: [FilesClient],
  exports: [ClientsModule, FilesClient],
})
export class FilesClientModule {}

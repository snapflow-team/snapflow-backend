import { ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { Configuration } from './configuration/configuration';
import { EnvironmentSettings } from './configuration/environment-settings';

export const ADMIN_GRAPHQL_PATH = '/admin/graphql';

export const getAdminGraphqlModuleOptions = (
  configService: ConfigService<Configuration, true>,
): ApolloDriverConfig => {
  const environmentSettings = configService.get<EnvironmentSettings>('environmentSettings');
  const enableDevFeatures = environmentSettings.isDevelopment || environmentSettings.isStaging;

  return {
    autoSchemaFile: join(process.cwd(), 'apps/snapflow-core/src/modules/admin/admin-schema.gql'),
    sortSchema: true,
    path: ADMIN_GRAPHQL_PATH,
    playground: enableDevFeatures,
    introspection: enableDevFeatures,
    context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
  };
};

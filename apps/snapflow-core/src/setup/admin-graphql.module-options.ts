import { ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { GraphQLFormattedError } from 'graphql';
import { join } from 'path';
import { Configuration } from './configuration/configuration';
import { EnvironmentSettings } from './configuration/environment-settings';

const sanitizeGraphqlError = (formattedError: GraphQLFormattedError): GraphQLFormattedError => {
  const code = formattedError.extensions?.code;

  if (code === 'BAD_USER_INPUT' || code === 'GRAPHQL_VALIDATION_FAILED') {
    return {
      message: 'Invalid input',
      extensions: { code },
    };
  }

  if (!formattedError.extensions?.stacktrace) {
    return formattedError;
  }

  const { stacktrace: _stacktrace, ...restExtensions } = formattedError.extensions;

  return {
    ...formattedError,
    extensions: restExtensions,
  };
};

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
    includeStacktraceInErrorResponses: false,
    formatError: sanitizeGraphqlError,
    context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
  };
};

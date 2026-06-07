import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { DomainException } from '../../../../../../../libs/exceptions/core';

@Catch(DomainException)
export class AdminGqlExceptionsFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): GraphQLError | void {
    if (host.getType<GqlContextType>() !== 'graphql') {
      throw exception;
    }

    return new GraphQLError(exception.message, {
      extensions: {
        code: exception.code,
        fields: exception.extensions,
      },
    });
  }
}

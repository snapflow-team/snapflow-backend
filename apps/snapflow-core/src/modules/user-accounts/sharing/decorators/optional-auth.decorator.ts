import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const OptionalAuth = (): CustomDecorator<string> => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

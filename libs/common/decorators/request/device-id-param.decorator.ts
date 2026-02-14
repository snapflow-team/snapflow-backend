import { Param } from '@nestjs/common';
import { ParseUuidOrNotFoundPipe } from '../../pipes/parse-uuid-or-not-found.pipe';

export const DeviceIdParam = () => Param('deviceId', ParseUuidOrNotFoundPipe);

import { CursorQueryParamsDto } from '../../../../../../../libs/dto/cursor-query.params.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetNotificationsQueryParamsDto extends CursorQueryParamsDto {
  @ApiPropertyOptional({ example: 5, default: 5 })
  override limit = 5;
}

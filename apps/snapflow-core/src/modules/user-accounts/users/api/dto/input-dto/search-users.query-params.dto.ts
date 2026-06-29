import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { Trim } from '../../../../../../../../../libs/common/decorators/transform/trim.decorator';
import { CursorQueryParamsDto } from '../../../../../../../../../libs/dto/cursor-query.params.dto';

export class SearchUsersQueryParamsDto extends CursorQueryParamsDto {
  @ApiProperty({ description: 'Частичное совпадение username', example: 'ali' })
  @IsString()
  @MinLength(1)
  @Trim()
  username: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min } from 'class-validator';

export const PRESENCE_USER_IDS_MAX_BATCH = 100;

export class GetPresenceQueryParamsDto {
  @Transform(({ value }: TransformFnParams): unknown => {
    if (value === undefined || value === null || value === '') {
      return value;
    }

    const rawValues: unknown[] = Array.isArray(value) ? value : String(value).split(',');

    return rawValues.map((item) => Number(String(item).trim()));
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PRESENCE_USER_IDS_MAX_BATCH)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ApiProperty({
    type: String,
    description:
      'Идентификаторы пользователей через запятую (или массив). ' +
      `Максимум ${PRESENCE_USER_IDS_MAX_BATCH} id за запрос.`,
    example: '1,2,3',
  })
  userIds: number[];
}

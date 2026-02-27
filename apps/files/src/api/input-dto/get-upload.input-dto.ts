import { IsIn, IsMimeType, IsNumber, IsString, Max, Min } from 'class-validator';

export class GetUploadInputDto {
  @IsString()
  // @IsMimeType()
  @IsIn(['image/jpeg', 'image/png'])
  mimeType: 'image/jpeg' | 'image/png';

  @IsNumber()
  @Min(1)
  @Max(20 * 1024 * 1024) // 20MB)
  size: number;
}

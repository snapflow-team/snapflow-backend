import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class DirectUploadQueryDto {
  @IsString()
  @IsNotEmpty()
  profile!: string;

  @IsOptional()
  @IsString()
  originalName?: string;
}

export class CreateResumableUploadDto {
  @IsString()
  @IsNotEmpty()
  profile!: string;

  @IsInt()
  @Min(1)
  declaredSize!: number;

  @IsString()
  @IsNotEmpty()
  declaredMime!: string;

  @IsOptional()
  @IsString()
  originalName?: string;
}

import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class CreatePostInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  @Transform(({ value }: TransformFnParams): string[] =>
    value == null ? [] : Array.isArray(value) ? value : [value],
  )
  fileIds: string[] = [];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IsStringWithTrim } from '../../../../../../../../libs/common/decorators/validation/is-string-with-trim.decorator';

export const commentTextConstraints = {
  minLength: 1,
  maxLength: 300,
};

export class CreateCommentInputDto {
  @IsStringWithTrim(commentTextConstraints.minLength, commentTextConstraints.maxLength)
  @ApiProperty({
    description: 'Текст комментария от 1 до 300 символов',
    minLength: commentTextConstraints.minLength,
    maxLength: commentTextConstraints.maxLength,
    example: 'Great post!',
  })
  text: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Идентификатор родительского комментария для ответа',
    example: '42',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}

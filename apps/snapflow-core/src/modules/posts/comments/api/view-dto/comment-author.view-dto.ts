import { ApiProperty } from '@nestjs/swagger';

type CommentAuthorViewSource = {
  userId: number;
  username: string;
  avatarUrl: string | null;
};

export class CommentAuthorViewDto {
  @ApiProperty({
    type: String,
    example: '1',
    description: 'Идентификатор пользователя',
  })
  userId: string;

  @ApiProperty({ example: 'John', description: 'Имя пользователя' })
  username: string;

  @ApiProperty({
    type: String,
    example: 'https://cdn.example.com/users/10/file.jpg',
    nullable: true,
    description: 'Публичный URL аватара',
  })
  avatarUrl: string | null;

  static mapToView(author: CommentAuthorViewSource): CommentAuthorViewDto {
    const dto = new CommentAuthorViewDto();
    dto.userId = author.userId.toString();
    dto.username = author.username;
    dto.avatarUrl = author.avatarUrl;
    return dto;
  }
}

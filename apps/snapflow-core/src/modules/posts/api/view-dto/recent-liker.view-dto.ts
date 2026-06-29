import { ApiProperty } from '@nestjs/swagger';

type RecentLikerViewSource = {
  userId: number;
  avatarUrl: string | null;
};

export class RecentLikerViewDto {
  @ApiProperty({
    type: String,
    example: 42,
    description: 'Идентификатор пользователя',
  })
  userId: string;

  @ApiProperty({
    type: String,
    example: 'https://cdn.example.com/users/42/file.jpg',
    nullable: true,
    description: 'Публичный URL аватара',
  })
  avatarUrl: string | null;

  static mapToView(source: RecentLikerViewSource): RecentLikerViewDto {
    const dto = new RecentLikerViewDto();
    dto.userId = source.userId.toString();
    dto.avatarUrl = source.avatarUrl;

    return dto;
  }
}

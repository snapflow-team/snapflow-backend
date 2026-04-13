import { ApiProperty } from '@nestjs/swagger';

type OwnerViewSource = {
  ownerId: number;
  username: string;
  avatarUrl: string | null;
};
export class OwnerViewDto {
  @ApiProperty({
    type: String,
    example: 1,
    description: 'Идентификатор юзера',
  })
  ownerId: string;

  @ApiProperty({ example: 'John', description: 'Имя юзера' })
  username: string;

  @ApiProperty({
    type: String,
    example: 'https://cdn.example.com/users/10/file.jpg',
    nullable: true,
    description: 'Публичный URL',
  })
  avatarUrl: string | null;

  static mapToView(owner: OwnerViewSource): OwnerViewDto {
    const dto = new OwnerViewDto();
    dto.ownerId = owner.ownerId.toString();
    dto.username = owner.username;
    dto.avatarUrl = owner.avatarUrl;
    return dto;
  }
}

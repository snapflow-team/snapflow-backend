import { ApiProperty } from '@nestjs/swagger';

type OwnerViewSource = {
  firstName: string | null;
  lastName: string | null;
};
export class OwnerViewDto {
  @ApiProperty({ example: 'John', nullable: true, description: 'Owner first name' })
  firstName: string | null;

  @ApiProperty({ example: 'Doe', nullable: true, description: 'Owner last name' })
  lastName: string | null;
  static mapToView(owner: OwnerViewSource): OwnerViewDto {
    const dto = new OwnerViewDto();
    dto.firstName = owner.firstName ?? null;
    dto.lastName = owner.lastName ?? null;
    return dto;
  }
}

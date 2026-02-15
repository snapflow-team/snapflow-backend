import { Session } from '@generated/prisma';
import { ApiProperty } from '@nestjs/swagger';

export class SessionsViewDto {
  @ApiProperty({
    example: 'f11cf4ee-2e4e-433b-8539-0634d79e8db',
    description: 'Id сессии устройства',
  })
  deviceId: string;

  @ApiProperty({
    example: 'Chrome 105',
    description: 'Имя устройства. Получаем из header "user-agent"',
  })
  deviceName: string;

  @ApiProperty({
    example: '127.0.0.1',
    description: 'Ip адрес устройства',
  })
  ip: string;

  @ApiProperty({
    example: '2026-02-15T18:59:28.562Z',
    description: 'Дата последней генерации токенов',
  })
  lastVisit: string;

  static mapToView(session: Session): SessionsViewDto {
    const dto = new SessionsViewDto();

    dto.deviceId = session.deviceId;
    dto.deviceName = session.deviceName;
    dto.ip = session.ip;
    dto.lastVisit = session.iat.toISOString();

    return dto;
  }
}

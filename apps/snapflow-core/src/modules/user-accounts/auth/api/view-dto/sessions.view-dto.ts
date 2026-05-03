import { ApiProperty } from '@nestjs/swagger';
import { Session } from '@generated/prisma-snapflow';

export class SessionsViewDto {
  @ApiProperty({
    example: 'f11cf4ee-2e4e-433b-8539-0634d79e8db',
    description: 'Id сессии устройства',
  })
  deviceId: string;

  @ApiProperty({
    example: 'Chrome',
    description: 'Название браузера',
  })
  browserName: string;

  @ApiProperty({
    example: '124.0.0.0',
    description: 'Версия браузера',
  })
  browserVersion: string;

  @ApiProperty({
    example: 'Windows',
    description: 'Название операционной системы',
  })
  osName: string;

  @ApiProperty({
    example: '11',
    description: 'Версия операционной системы',
  })
  osVersion: string;

  @ApiProperty({
    example: 'Chrome 105',
    description: 'Имя устройства. Получаем из header "user-agent"',
  })
  deviceName: string;

  @ApiProperty({
    example: 'desktop',
    description: 'Тип устройства',
  })
  deviceType: string;

  @ApiProperty({
    example: '127.0.0.1',
    description: 'Ip адрес устройства',
  })
  ip: string;

  @ApiProperty({
    example: '2026-02-15T18:59:28.562Z',
    description: 'Дата последней генерации токенов',
  })
  lastActive: string;

  @ApiProperty({
    example: true,
    description: 'Текущая сессия, с которой выполнен запрос',
  })
  isCurrent: boolean;

  static mapToView(session: Session, currentDeviceId: string): SessionsViewDto {
    const dto = new SessionsViewDto();
    const browserName = session.browserName ?? 'Unknown browser';

    dto.deviceId = session.deviceId;
    dto.browserName = browserName;
    dto.browserVersion = session.browserVersion ?? '';
    dto.osName = session.osName ?? 'Unknown OS';
    dto.osVersion = session.osVersion ?? '';
    dto.deviceName = session.deviceName || browserName;
    dto.deviceType = session.deviceType ?? 'desktop';
    dto.ip = session.ip;
    dto.lastActive = session.iat.toISOString();
    dto.isCurrent = session.deviceId === currentDeviceId;

    return dto;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsEnum, IsNumber } from 'class-validator';
import { configValidationUtility } from '../../../libs/common/config/config-validation.utility';
import { Environments } from '../../../libs/common/enums/enviroments.enum';

/**
 * Настройки окружения для SnapflowCoreModule
 */
@Injectable()
export class SnapflowCoreConfig {
  @IsEnum(Environments, {
    message: `NODE_ENV must be one of: ${configValidationUtility.getEnumValues(Environments).join(', ')}`,
  })
  env: string;

  @IsNumber(
    {},
    {
      message: 'Set PORT variable value, example: 3000',
    },
  )
  port: number;

  @IsBoolean({
    message: 'IS_SWAGGER_ENABLED requires true/false',
  })
  isSwaggerEnabled: boolean;

  constructor(private configService: ConfigService<any, true>) {
    this.env = this.configService.get('NODE_ENV');
    this.port = Number(this.configService.get('PORT'));
    this.isSwaggerEnabled = configValidationUtility.convertToBoolean(
      this.configService.get('IS_SWAGGER_ENABLED'),
    ) as boolean;

    configValidationUtility.validateConfig(this);
  }
}

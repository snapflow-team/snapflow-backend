import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'class-validator';
import { configValidationUtility } from '../../../libs/common/config/config-validation.utility';
import { Environments } from '../../../libs/common/enums/enviroments.enum';

@Injectable()
export class FilesConfig {
  @IsEnum(Environments, {
    message: `NODE_ENV must be one of: ${configValidationUtility.getEnumValues(Environments).join(', ')}`,
  })
  env: string;

  @IsNumber({}, { message: 'Set PORT variable value, example: 5005' })
  port: number;

  @IsBoolean({
    message: 'IS_SWAGGER_ENABLED requires true/false',
  })
  isSwaggerEnabled: boolean;

  @IsString({
    message:
      'ALLOWED_ORIGINS must be a comma-separated string of URLs or "*" (e.g., "http://localhost:3000,https://app.com")',
  })
  allowedOriginsRaw: string;

  @IsBoolean({
    message:
      'Set Env variable SEND_INTERNAL_SERVER_ERROR_DETAILS to enable/disable internal error details, available values: true, false, 0, 1',
  })
  sendInternalServerErrorDetails: boolean;

  constructor(private readonly configService: ConfigService<any, true>) {
    this.env = this.configService.get('NODE_ENV');
    this.port = Number(this.configService.get('PORT'));
    this.isSwaggerEnabled = configValidationUtility.convertToBoolean(
      this.configService.get('IS_SWAGGER_ENABLED'),
    ) as boolean;
    this.allowedOriginsRaw = this.configService.get('ALLOWED_ORIGINS');
    this.sendInternalServerErrorDetails = configValidationUtility.convertToBoolean(
      this.configService.get('SEND_INTERNAL_SERVER_ERROR_DETAILS'),
    ) as boolean;

    configValidationUtility.validateConfig(this);
  }

  get allowedOrigins(): string[] | boolean {
    if (this.allowedOriginsRaw === '*' || this.allowedOriginsRaw === 'true') {
      return true;
    }
    return this.allowedOriginsRaw.split(',').map((item) => item.trim());
  }
}

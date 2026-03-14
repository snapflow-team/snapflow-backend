import { IsNumber, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class BusinessRulesSettings {
  @IsString()
  appEmail: string;

  @IsString()
  appPassword: string;

  @IsNumber()
  sessionCleanupRetentionDays: number;

  @IsNumber()
  avatarImageSizeMb: number;

  @IsString()
  avatarAllowedMimeTypes: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.appEmail = environmentVariables.EMAIL_APP;
    this.appPassword = environmentVariables.EMAIL_APP_PASSWORD;

    this.sessionCleanupRetentionDays = Number.parseInt(
      environmentVariables.SESSION_CLEANUP_RETENTION_DAYS,
    );

    this.avatarImageSizeMb = Number.parseInt(environmentVariables.AVATAR_IMAGE_SIZE_MB);
    this.avatarAllowedMimeTypes = environmentVariables.AVATAR_ALLOWED_MIME_TYPES;
  }

  getAvatarImageSize(): number {
    return this.avatarImageSizeMb * 1024 * 1024;
  }

  getAvatarAllowedMimeTypes(): string[] {
    return this.avatarAllowedMimeTypes.split(',');
  }
}

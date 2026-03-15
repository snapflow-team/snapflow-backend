import {
  FileTypeValidator,
  Inject,
  Injectable,
  MaxFileSizeValidator,
  ParseFilePipe,
  UploadedFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessRulesSettings } from '../../../../../setup/configuration/business-rules-settings';
import { Configuration } from '../../../../../setup/configuration/configuration';

@Injectable()
export class AvatarFilePipe extends ParseFilePipe {
  constructor(@Inject(ConfigService) private configService: ConfigService<Configuration, true>) {
    const businessRules: BusinessRulesSettings =
      configService.get<BusinessRulesSettings>('businessRulesSettings');

    const maxSize: number = businessRules.getAvatarImageSize();
    const allowedTypesRegex = new RegExp(
      businessRules.getAvatarAllowedMimeTypes().join('|').replace(/\//g, '\\/'),
    );

    super({
      fileIsRequired: true,
      validators: [
        new MaxFileSizeValidator({ maxSize }),
        new FileTypeValidator({ fileType: allowedTypesRegex }),
      ],
    });
  }
}

/**
 * Кастомный декоратор для загрузки аватара.
 * Автоматически проверяет наличие файла, его размер (10MB) и формат (JPEG/PNG) через BusinessRulesSettings.
 */
export const AvatarFile = () => UploadedFile(AvatarFilePipe);

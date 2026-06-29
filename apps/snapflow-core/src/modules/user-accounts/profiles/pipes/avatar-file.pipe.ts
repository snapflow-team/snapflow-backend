import { FileTypeValidator, Injectable, MaxFileSizeValidator, ParseFilePipe, UploadedFile, } from '@nestjs/common';
import { ValidationException } from '../../../../../../../libs/exceptions/core';
import { AVATAR_IMAGE_SIZE } from '../../../../../../../libs/common/constants/image-size.constants';
import { MimetypeAvatar } from '../../../../../../../libs/contracts/files/mimetype-avatar.enum';

@Injectable()
export class AvatarFilePipe extends ParseFilePipe {
  constructor() {
    const allowedTypes: MimetypeAvatar[] = Object.values(MimetypeAvatar);
    const fileTypeRegex = new RegExp(allowedTypes.join('|'));

    super({
      fileIsRequired: true,
      validators: [
        new MaxFileSizeValidator({ maxSize: AVATAR_IMAGE_SIZE }),
        new FileTypeValidator({ fileType: fileTypeRegex }),
      ],
      exceptionFactory: (errors: string) => {
        return new ValidationException([
          {
            field: 'avatar',
            message: errors,
          },
        ]);
      },
    });
  }
}

/**
 * Кастомный декоратор для загрузки аватара.
 * Автоматически проверяет наличие файла, его размер (10MB) и формат (JPEG/PNG) через BusinessRulesSettings.
 */
export const AvatarFile = () => UploadedFile(AvatarFilePipe);

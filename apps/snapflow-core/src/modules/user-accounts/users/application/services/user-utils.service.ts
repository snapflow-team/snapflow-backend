import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { usernameConstraints } from '../../../auth/api/input-dto/registration-user.input-dto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserUtilsService {
  constructor(private readonly cryptoService: CryptoService) {}

  generateUsername(base: string): string {
    const minUsernameLength: number = usernameConstraints.minLength;
    const maxUsernameLength: number = usernameConstraints.maxLength;
    const namePart: string = base.split('@')[0];

    let clean: string = namePart
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');

    if (clean.length < minUsernameLength) {
      clean = clean.padEnd(usernameConstraints.minLength, '0');
    }

    const suffix: string = this.cryptoService.generateShortId();

    const basePart: string = clean.slice(0, maxUsernameLength - (suffix.length + 1));

    return `${basePart}-${suffix}`;
  }
}

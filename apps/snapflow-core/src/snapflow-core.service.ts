import { Injectable } from '@nestjs/common';

@Injectable()
export class SnapflowCoreService {
  getHello(): string {
    return 'Hello SnapFlow Backend team!';
  }
}

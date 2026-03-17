import { Injectable } from '@nestjs/common';

@Injectable()
export class SnapflowCoreService {
  constructor() {}

  getHello(): string {
    return 'Hello SnapFlow Backend team!';
  }
}

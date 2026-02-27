import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class SnapflowCoreService {
  constructor(@Inject('FILES_SERVICE') private filesClient: ClientProxy) {}

  async onModuleInit() {
    try {
      await this.filesClient.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('FILES_SERVICE TCP is unavailable on startup:', message);
    }
  }
  getHello(): string {
    return 'Hello SnapFlow Backend team!';
  }

  async createPost(dto) {
    const res = await lastValueFrom(
      this.filesClient.send({ cmd: 'validate_files' }, { fileIds: dto.mediaIds }),
    );
    return res;
  }
}

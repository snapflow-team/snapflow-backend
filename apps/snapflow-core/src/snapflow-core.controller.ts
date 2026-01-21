import { Controller, Get } from '@nestjs/common';
import { SnapflowCoreService } from './snapflow-core.service';

@Controller()
export class SnapflowCoreController {
  constructor(private readonly snapflowCoreService: SnapflowCoreService) {}

  @Get()
  getHello(): string {
    return this.snapflowCoreService.getHello();
  }
}

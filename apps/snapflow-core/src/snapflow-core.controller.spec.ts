import { Test, TestingModule } from '@nestjs/testing';
import { SnapflowCoreController } from './snapflow-core.controller';
import { SnapflowCoreService } from './snapflow-core.service';

describe('SnapflowCoreController', () => {
  let snapflowCoreController: SnapflowCoreController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SnapflowCoreController],
      providers: [SnapflowCoreService],
    }).compile();

    snapflowCoreController = app.get<SnapflowCoreController>(SnapflowCoreController);
  });

  describe('root', () => {
    it('should return "Hello SnapFlow Backend team!"', () => {
      expect(snapflowCoreController.getHello()).toBe('Hello SnapFlow Backend team!');
    });
  });
});

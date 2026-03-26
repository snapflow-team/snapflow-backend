import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './modules/database/prisma.module';

@Module({
  imports: [CoreModule, PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

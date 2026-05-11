import { Module } from '@nestjs/common';
import { ArWorkbenchController } from './ar-workbench.controller';
import { ArWorkbenchService } from './ar-workbench.service';

@Module({
  controllers: [ArWorkbenchController],
  providers: [ArWorkbenchService],
})
export class ArWorkbenchModule {}

import { Module } from '@nestjs/common';
import { WorkflowGraphController } from './workflow-graph.controller';
import { WorkflowGraphService } from './workflow-graph.service';

@Module({
  controllers: [WorkflowGraphController],
  providers: [WorkflowGraphService],
})
export class WorkflowGraphModule {}

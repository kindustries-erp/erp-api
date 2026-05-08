import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { WorkflowGraphService } from './workflow-graph.service';

@ApiTags('WorkflowGraph')
@ApiBearerAuth()
@Controller('workflow-graph')
@UseGuards(DirectusAuthGuard)
export class WorkflowGraphController {
  constructor(private readonly workflowGraphService: WorkflowGraphService) {}

  @ApiOperation({
    summary: 'Sơ đồ quy trình ERP (nodes & edges)',
    description:
      'Trả về toàn bộ nodes (phân hệ, trạng thái) và edges (mối liên kết, luồng duyệt) ' +
      'dưới dạng graph để render canvas tại ERP UI.',
  })
  @Get()
  getGraph() {
    return this.workflowGraphService.getGraph();
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { toPaginatedResult } from '@/common/utils/paginated-result';
import { QueryAiHubUsageLogDto } from './dto/query-ai-hub-usage-log.dto';
import { toAiHubUsageLogResponse } from './helpers/ai-hub-usage-log.mapper';
import { AiGatewayHealthService } from './services/ai-gateway-health.service';
import { AiHubUsageLogQueryService } from './services/ai-hub-usage-log-query.service';

/** Facade của module: tra cứu usage log và kiểm tra gateway. Luôn trả response DTO. */
@Injectable()
export class AiHubGatewayService {
  constructor(
    private readonly query: AiHubUsageLogQueryService,
    private readonly healthService: AiGatewayHealthService,
  ) {}

  health() {
    return this.healthService.check();
  }

  async findAll(dto: QueryAiHubUsageLogDto) {
    const page = await this.query.findAll(dto);
    return toPaginatedResult(
      page.items.map((item) => toAiHubUsageLogResponse(item)),
      page.page,
      page.pageSize,
      page.total,
      page.summaries,
    );
  }

  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters?: string,
  ) {
    return this.query.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
    );
  }

  async findOne(id: string) {
    const entity = await this.query.findById(id);
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy usage log với id ${id}`);
    }
    return {
      message: 'Lấy thông tin thành công',
      data: toAiHubUsageLogResponse(entity),
    };
  }
}

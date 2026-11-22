import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import { RelatedOrderDto } from '@/v2/core/procurement-requests-core/dto/procurement-request-response.dto';

/**
 * Đọc-chỉ: tra các PO đã sinh từ từng đề nghị, theo lô (một query cho cả trang).
 * Không import module PO; chỉ dùng entity để tránh vòng phụ thuộc module.
 */
@Injectable()
export class GarageProcurementRequestOrderRefService {
  constructor(
    @InjectRepository(GarageProcurementOrder)
    private readonly orders: Repository<GarageProcurementOrder>,
  ) {}

  /** Map requestId -> PO còn hiệu lực (bỏ đã xóa mềm), sắp theo createdAt tăng. */
  async forRequests(
    requestIds: string[],
  ): Promise<Map<string, RelatedOrderDto[]>> {
    const result = new Map<string, RelatedOrderDto[]>();
    const ids = [...new Set(requestIds)];
    if (ids.length === 0) return result;

    const rows = await this.orders.find({
      where: { requestId: In(ids), isDeleted: false },
      select: { id: true, orderNo: true, status: true, requestId: true },
      order: { createdAt: 'ASC' },
    });

    for (const row of rows) {
      if (!row.requestId) continue;
      const list = result.get(row.requestId) ?? [];
      list.push({ id: row.id, orderNo: row.orderNo, status: row.status });
      result.set(row.requestId, list);
    }
    return result;
  }
}

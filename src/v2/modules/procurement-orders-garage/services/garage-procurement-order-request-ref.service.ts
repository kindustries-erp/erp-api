import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GarageProcurementRequest } from '@/v2/modules/procurement-requests-garage/entities/procurement-request.entity';

/**
 * Đọc-chỉ: tra số đề nghị theo lô id. Không lọc isDeleted: đề nghị đã xóa mềm vẫn hiện số.
 * Không import module PR; chỉ dùng entity.
 */
@Injectable()
export class GarageProcurementOrderRequestRefService {
  constructor(
    @InjectRepository(GarageProcurementRequest)
    private readonly requests: Repository<GarageProcurementRequest>,
  ) {}

  /** Map requestId -> requestNo. Id rỗng thì không query. */
  async requestNos(requestIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const ids = [...new Set(requestIds)];
    if (ids.length === 0) return result;

    const rows = await this.requests.find({
      where: { id: In(ids) },
      select: { id: true, requestNo: true },
    });
    for (const row of rows) result.set(row.id, row.requestNo);
    return result;
  }
}

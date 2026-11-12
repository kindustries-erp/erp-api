import { NotFoundException } from '@nestjs/common';
import {
  DataSource,
  EntityTarget,
  FindOptionsWhere,
  ILike,
  Repository,
} from 'typeorm';
import { PagedList, toPagedList } from '@/common/utils/paginated-result';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts-core/services/base-voucher-engine.service';
import { BaseStockVoucherLineEntity } from '../entities/lines/base-stock-voucher-line.entity';

export interface StockVoucherListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

/**
 * Đọc chứng từ kho có dòng: danh sách có phân trang, chi tiết kèm dòng, và sinh số chứng từ theo ngày.
 * Chỉ đọc, không ghi. Lớp con cung cấp entity và tiền tố số chứng từ.
 */
export abstract class AbstractStockLineVoucherQueryService<
  H extends {
    id: string;
    voucherNo: string;
    voucherDate: Date;
    status: string;
    isDeleted: boolean;
  },
  L extends BaseStockVoucherLineEntity & { voucherId: string },
> {
  protected abstract readonly headerEntity: EntityTarget<H>;
  protected abstract readonly lineEntity: EntityTarget<L>;
  /** Tiền tố số chứng từ, ví dụ GSR → GSR-YYYYMMDD-NNN. */
  protected abstract readonly voucherPrefix: string;

  constructor(
    protected readonly dataSource: DataSource,
    protected readonly voucherEngine: BaseVoucherEngineService,
  ) {}

  async findAll(query: StockVoucherListQuery): Promise<PagedList<H>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const where: FindOptionsWhere<H> = {
      isDeleted: false,
    } as FindOptionsWhere<H>;
    if (query.search) {
      (where as Record<string, unknown>).voucherNo = ILike(`%${query.search}%`);
    }
    if (query.status) {
      (where as Record<string, unknown>).status = query.status;
    }
    const repo = this.dataSource.getRepository(
      this.headerEntity,
    ) as Repository<H>;
    const [items, total] = await repo.findAndCount({
      where,
      order: { voucherDate: 'DESC', voucherNo: 'DESC' } as never,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return toPagedList(items, page, pageSize, total);
  }

  /** Chi tiết chứng từ kèm dòng. Ném 404 khi không có hoặc đã xóa mềm. */
  async findOne(id: string): Promise<{ header: H; lines: L[] }> {
    const repo = this.dataSource.getRepository(
      this.headerEntity,
    ) as Repository<H>;
    const header = await repo.findOne({
      where: { id, isDeleted: false } as never,
    });
    if (!header) throw new NotFoundException('Không tìm thấy chứng từ');
    const lines = await this.dataSource.getRepository(this.lineEntity).find({
      where: { voucherId: id } as never,
      order: { lineNo: 'ASC' } as never,
    });
    return { header, lines: lines as unknown as L[] };
  }

  /** Số chứng từ kế tiếp trong ngày, dùng chung cơ chế đánh số của lõi nhập kho. */
  async nextVoucherNo(voucherDate?: string): Promise<string> {
    const repo = this.dataSource.getRepository(
      this.headerEntity,
    ) as Repository<H>;
    return this.voucherEngine.generateDailyVoucherNo(
      repo,
      'voucherNo',
      this.voucherPrefix,
      voucherDate,
    );
  }
}

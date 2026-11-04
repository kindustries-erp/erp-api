import { Injectable } from '@nestjs/common';
import { EntityManager, EntityTarget } from 'typeorm';

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Sinh số chứng từ PO theo ngày: PREFIX-YYYYMMDD-001.
 * Khóa advisory (pg_advisory_xact_lock) theo prefix+ngày trong transaction,
 * nên hai request đồng thời không nhận cùng số (#5). Ngày theo múi giờ VN.
 */
@Injectable()
export class PurchaseOrderNumberingService {
  /** YYYYMMDD theo giờ VN. Ngày không hợp lệ thì dùng thời điểm hiện tại (#9). */
  formatVnDate(input?: string | Date): string {
    const parsed =
      input instanceof Date ? input : input ? new Date(input) : new Date();
    const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: VN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    return parts.replace(/-/g, '');
  }

  /**
   * Sinh số kế tiếp. Phải gọi trong transaction (manager của transaction),
   * vì khóa advisory chỉ giữ tới khi transaction kết thúc.
   */
  async nextNo(
    manager: EntityManager,
    target: EntityTarget<{ poNo: string }>,
    prefix: string,
    orderDate?: string | Date,
  ): Promise<string> {
    const datePart = this.formatVnDate(orderDate);
    const base = `${prefix}-${datePart}-`;

    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [base]);

    const latest = await manager
      .getRepository(target)
      .createQueryBuilder('po')
      .where('po.poNo LIKE :prefix', { prefix: `${base}%` })
      .orderBy('po.poNo', 'DESC')
      .getOne();

    const current = latest ? Number(latest.poNo.slice(base.length)) : 0;
    const seq = Number.isFinite(current) ? current : 0;
    return `${base}${String(seq + 1).padStart(3, '0')}`;
  }
}

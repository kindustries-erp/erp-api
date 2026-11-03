import { BadRequestException, Injectable } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { IVoucherLine, VoucherStatus } from '../contracts/voucher.contract';

@Injectable()
export class BaseVoucherEngineService {
  /**
   * Sinh mã chứng từ tự động tăng dần theo ngày theo định dạng: {prefix}-{YYYYMMDD}-{sequence:000}
   * @param repo Repository bảng Header
   * @param fieldName Tên trường chứa mã chứng từ (mặc định 'receiptNo')
   * @param prefix Tiền tố chứng từ (vd: 'GGR', 'GR', 'PO')
   * @param orderDate Ngày chứng từ (mặc định hôm nay)
   */
  async generateDailyVoucherNo<T extends ObjectLiteral>(
    repo: Repository<T>,
    fieldName: string,
    prefix: string,
    orderDate?: string | Date,
  ): Promise<string> {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const dailyPrefix = `${prefix}-${year}${month}${day}-`;

    const latest = await repo
      .createQueryBuilder('voucher')
      .where(`voucher.${fieldName} LIKE :prefix`, {
        prefix: `${dailyPrefix}%`,
      })
      .orderBy(`voucher.${fieldName}`, 'DESC')
      .getOne();

    const voucherRecord = latest as Record<string, any> | null;
    const latestValue: string | undefined = voucherRecord?.[fieldName];
    const latestSeq = latestValue?.slice(dailyPrefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${dailyPrefix}${nextSeq}`;
  }

  /**
   * Kiểm tra tính hợp lệ của việc chuyển đổi trạng thái chứng từ (StateMachine Validator)
   */
  validateVoucherTransition(
    currentStatus: VoucherStatus | string,
    action: 'post' | 'cancel' | 'delete' | 'update',
  ): void {
    if (action === 'update' && currentStatus !== 'DRAFT') {
      throw new BadRequestException(
        `Chỉ có thể chỉnh sửa chứng từ ở trạng thái Nháp (DRAFT). Trạng thái hiện tại: ${currentStatus}`,
      );
    }

    if (action === 'delete' && currentStatus !== 'DRAFT') {
      throw new BadRequestException(
        `Chỉ có thể xóa chứng từ ở trạng thái Nháp (DRAFT). Trạng thái hiện tại: ${currentStatus}`,
      );
    }

    if (action === 'post') {
      if (currentStatus === 'POSTED') {
        throw new BadRequestException('Chứng từ này đã được ghi sổ trước đó');
      }
      if (currentStatus === 'CANCELLED') {
        throw new BadRequestException('Không thể ghi sổ chứng từ đã bị hủy');
      }
    }

    if (action === 'cancel') {
      if (currentStatus === 'CANCELLED') {
        throw new BadRequestException('Chứng từ đã bị hủy trước đó');
      }
    }
  }

  /**
   * Tính toán tổng tiền từ danh sách dòng hàng chi tiết
   */
  sumLineAmounts<T extends IVoucherLine>(lines: T[]): number {
    return lines.reduce((total, line) => {
      const qty = Number(line.qtyReceived || 0);
      const cost = Number(line.unitCost || 0);
      const lineAmount =
        line.amount !== undefined && line.amount !== null
          ? Number(line.amount)
          : qty * cost;
      return total + lineAmount;
    }, 0);
  }
}

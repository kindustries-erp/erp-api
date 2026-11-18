import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CashflowVoucherCodePort,
  CashflowVoucherType,
} from '@/v2/core/cashflow-vouchers-core';
import { CashflowVoucherGarage } from '../entities/cashflow-voucher-garage.entity';
import {
  formatVoucherCode,
  voucherCodePrefix,
} from '../helpers/garage-voucher-code.helper';

/** Sinh mã `PT/PC-GARA-yymmdd-NNN`: lấy số thứ tự tiếp theo trong ngày, bỏ qua mã đã bị chiếm. */
@Injectable()
export class GarageVoucherCodeService implements CashflowVoucherCodePort {
  constructor(
    @InjectRepository(CashflowVoucherGarage)
    private readonly vouchers: Repository<CashflowVoucherGarage>,
  ) {}

  async next(
    voucherType: CashflowVoucherType,
    transDate: string,
    isTaken: (code: string) => Promise<boolean>,
  ): Promise<string> {
    const prefix = voucherCodePrefix(voucherType, transDate);
    const used = await this.vouchers
      .createQueryBuilder('v')
      .where('v.voucher_code LIKE :like', { like: `${prefix}-%` })
      .getCount();
    for (let seq = used + 1; ; seq += 1) {
      const code = formatVoucherCode(prefix, seq);
      if (!(await isTaken(code))) return code;
    }
  }
}

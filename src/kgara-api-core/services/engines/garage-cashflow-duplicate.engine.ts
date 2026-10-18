import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { KgaraCashflowVoucher } from '../../entities/kgara_cashflow_voucher.entity';
import {
  CheckKgaraCashflowDuplicateQueryDto,
  KgaraCashflowDuplicateGroupDto,
  KgaraCashflowDuplicateResponseDto,
} from '../../dto/garage-cashflow.dto';

const NEARBY_DAYS = 7;
const MAX_ITEMS = 5;
const EMPTY_GROUP: KgaraCashflowDuplicateGroupDto = { items: [], total: 0 };

@Injectable()
export class GarageCashflowDuplicateEngine {
  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
  ) {}

  static normalizePlate(plate?: string): string {
    return (plate ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
  }

  static shiftDate(isoDate: string, days: number): string {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async findPotentialDuplicates(
    q: CheckKgaraCashflowDuplicateQueryDto,
  ): Promise<KgaraCashflowDuplicateResponseDto> {
    const base = (): SelectQueryBuilder<KgaraCashflowVoucher> => {
      const qb = this.voucherRepo
        .createQueryBuilder('v')
        .leftJoinAndSelect('v.case', 'c')
        .where('v.amount = :amount', { amount: q.amount });
      if (q.excludeId)
        qb.andWhere('v.id <> :excludeId', { excludeId: q.excludeId });
      return qb;
    };

    const run = async (
      qb: SelectQueryBuilder<KgaraCashflowVoucher>,
    ): Promise<KgaraCashflowDuplicateGroupDto> => {
      const [rows, total] = await qb
        .orderBy('v.transDate', 'DESC')
        .addOrderBy('v.createdAt', 'DESC')
        .take(MAX_ITEMS)
        .getManyAndCount();
      return {
        total,
        items: rows.map((r) => ({
          id: r.id,
          voucherCode: r.voucherCode,
          voucherType: r.voucherType,
          amount: Number(r.amount) || 0,
          transDate: r.transDate,
          licensePlate: r.licensePlate ?? null,
          caseCode: r.case?.soChungTu ?? null,
          partnerName: r.partnerName ?? null,
        })),
      };
    };

    const center = q.transDate || new Date().toISOString().slice(0, 10);
    const nearbyQb = base().andWhere('v.transDate BETWEEN :from AND :to', {
      from: GarageCashflowDuplicateEngine.shiftDate(center, -NEARBY_DAYS),
      to: GarageCashflowDuplicateEngine.shiftDate(center, NEARBY_DAYS),
    });

    const plate = GarageCashflowDuplicateEngine.normalizePlate(q.licensePlate);
    const [nearbyDate, sameCase, samePlate] = await Promise.all([
      run(nearbyQb),
      q.caseId
        ? run(base().andWhere('v.caseId = :caseId', { caseId: q.caseId }))
        : EMPTY_GROUP,
      plate
        ? run(
            base().andWhere(
              "regexp_replace(upper(COALESCE(v.licensePlate, c.bienSoXe, '')), '[^0-9A-Z]', '', 'g') = :plate",
              { plate },
            ),
          )
        : EMPTY_GROUP,
    ]);
    return { nearbyDate, sameCase, samePlate };
  }
}

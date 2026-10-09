import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCase } from '../entities/kgara_case.entity';
import {
  CreateKgaraCashflowVoucherDto,
  UpdateKgaraCashflowVoucherDto,
  ListKgaraCashflowVoucherQueryDto,
} from '../dto/garage-cashflow.dto';

@Injectable()
export class GarageCashflowService {
  private readonly logger = new Logger(GarageCashflowService.name);

  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    private readonly dataSource: DataSource,
  ) {}

  async createVoucher(
    dto: CreateKgaraCashflowVoucherDto,
  ): Promise<KgaraCashflowVoucher> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      const codePrefix = dto.voucherType === 'RECEIPT' ? 'PT-GARA' : 'PC-GARA';
      const dateStr = now
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '')
        .substring(2);
      // Temporary naive sequence generation. Real impl might need a sequence table.
      const randomSeq = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      const generatedCode =
        dto.voucherCode || `${codePrefix}-${dateStr}-${randomSeq}`;

      let caseRef: KgaraCase | undefined;
      if (dto.caseId) {
        const kCase = await queryRunner.manager.findOne(KgaraCase, {
          where: { id: dto.caseId },
        });
        if (!kCase) {
          throw new NotFoundException(`Case ${dto.caseId} not found`);
        }
        caseRef = kCase;
      }

      const newVoucher = queryRunner.manager.create(KgaraCashflowVoucher, {
        voucherCode: generatedCode,
        voucherType: dto.voucherType,
        amount: dto.amount,
        transDate: dto.transDate,
        caseId: dto.caseId || undefined,
        erpBankTransactionId: dto.erpBankTransactionId || undefined,
        erpCashVoucherId: dto.erpCashVoucherId || undefined,
        note: dto.note || undefined,
      });

      const savedVoucher = await queryRunner.manager.save(newVoucher);

      // Generate / update settlement if linked to case
      if (dto.caseId) {
        const newSettlement = queryRunner.manager.create(KgaraCaseSettlement, {
          caseId: dto.caseId || undefined,
          settlementType: dto.voucherType,
          amount: dto.amount,
          transDate: dto.transDate || undefined,
          bankTransactionId: dto.erpBankTransactionId || undefined,
          cashflowVoucherId: savedVoucher.id,
          sourceChannel: 'ON_SYSTEM',
          paymentMethod: 'CASH',
          payerType: 'KH',
          note: dto.note || undefined,
          partnerName: caseRef?.khachHangName || undefined,
        });
        await queryRunner.manager.save(newSettlement);
      }

      await queryRunner.commitTransaction();
      return savedVoucher;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateVoucher(
    id: string,
    dto: UpdateKgaraCashflowVoucherDto,
  ): Promise<KgaraCashflowVoucher> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingVoucher = await queryRunner.manager.findOne(
        KgaraCashflowVoucher,
        { where: { id } },
      );
      if (!existingVoucher) {
        throw new NotFoundException(`Voucher ${id} not found`);
      }

      const oldCaseId = existingVoucher.caseId;
      const newCaseId = dto.caseId !== undefined ? dto.caseId : oldCaseId;
      const oldAmount = existingVoucher.amount;
      const newAmount = dto.amount !== undefined ? dto.amount : oldAmount;
      const oldTransDate = existingVoucher.transDate;
      const newTransDate =
        dto.transDate !== undefined ? dto.transDate : oldTransDate;
      const oldType = existingVoucher.voucherType;
      const newType = dto.voucherType !== undefined ? dto.voucherType : oldType;

      queryRunner.manager.merge(KgaraCashflowVoucher, existingVoucher, dto);
      const updatedVoucher = await queryRunner.manager.save(existingVoucher);

      // Update linked settlement
      const existingSettlement = await queryRunner.manager.findOne(
        KgaraCaseSettlement,
        {
          where: { cashflowVoucherId: id },
        },
      );

      if (existingSettlement) {
        if (newCaseId === null && oldCaseId) {
          // Disconnected from case, remove settlement
          await queryRunner.manager.remove(existingSettlement);
        } else {
          // Update settlement
          existingSettlement.caseId = newCaseId || undefined;
          existingSettlement.amount = newAmount;
          existingSettlement.transDate = newTransDate;
          existingSettlement.settlementType = newType;
          if (dto.note !== undefined) existingSettlement.note = dto.note;
          if (dto.erpBankTransactionId !== undefined)
            existingSettlement.bankTransactionId = dto.erpBankTransactionId;
          await queryRunner.manager.save(existingSettlement);
        }
      } else if (newCaseId) {
        // Connect to a new case, create settlement
        let partnerName: string | undefined = undefined;
        const kCase = await queryRunner.manager.findOne(KgaraCase, {
          where: { id: newCaseId },
        });
        if (kCase) partnerName = kCase.khachHangName || undefined;

        const newSettlement = queryRunner.manager.create(KgaraCaseSettlement, {
          caseId: newCaseId,
          settlementType: newType,
          amount: newAmount,
          transDate: newTransDate || undefined,
          bankTransactionId: updatedVoucher.erpBankTransactionId || undefined,
          cashflowVoucherId: updatedVoucher.id,
          sourceChannel: 'ON_SYSTEM',
          paymentMethod: 'CASH',
          payerType: 'KH',
          note: updatedVoucher.note || undefined,
          partnerName,
        });
        await queryRunner.manager.save(newSettlement);
      }

      await queryRunner.commitTransaction();
      return updatedVoucher;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteVoucher(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingVoucher = await queryRunner.manager.findOne(
        KgaraCashflowVoucher,
        { where: { id } },
      );
      if (!existingVoucher) {
        throw new NotFoundException(`Voucher ${id} not found`);
      }

      const existingSettlement = await queryRunner.manager.findOne(
        KgaraCaseSettlement,
        {
          where: { cashflowVoucherId: id },
        },
      );

      if (existingSettlement) {
        await queryRunner.manager.remove(existingSettlement);
      }

      await queryRunner.manager.remove(existingVoucher);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getDashboardStats() {
    const kpi = await this.voucherRepo
      .createQueryBuilder('v')
      .select(
        `SUM(CASE WHEN v.voucher_type = 'RECEIPT' THEN v.amount ELSE 0 END)`,
        'totalIn',
      )
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'PAYMENT' THEN v.amount ELSE 0 END)`,
        'totalOut',
      )
      .where('v.deleted_at IS NULL')
      .getRawOne();

    const breakdownIn = await this.voucherRepo
      .createQueryBuilder('v')
      .select('v.payment_method', 'method')
      .addSelect('SUM(v.amount)', 'amount')
      .where("v.voucher_type = 'RECEIPT'")
      .andWhere('v.deleted_at IS NULL')
      .groupBy('v.payment_method')
      .getRawMany();

    const breakdownOut = await this.voucherRepo
      .createQueryBuilder('v')
      .select('v.payment_method', 'method')
      .addSelect('SUM(v.amount)', 'amount')
      .where("v.voucher_type = 'PAYMENT'")
      .andWhere('v.deleted_at IS NULL')
      .groupBy('v.payment_method')
      .getRawMany();

    const trend = await this.voucherRepo
      .createQueryBuilder('v')
      .select(`TO_CHAR(v.trans_date, 'YYYY-MM')`, 'month')
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'RECEIPT' THEN v.amount ELSE 0 END)`,
        'in_amount',
      )
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'PAYMENT' THEN v.amount ELSE 0 END)`,
        'out_amount',
      )
      .where('v.deleted_at IS NULL')
      .groupBy(`TO_CHAR(v.trans_date, 'YYYY-MM')`)
      .orderBy(`TO_CHAR(v.trans_date, 'YYYY-MM')`, 'DESC')
      .limit(6)
      .getRawMany();

    return {
      kpi: {
        totalIn: Number(kpi?.totalin || 0),
        totalOut: Number(kpi?.totalout || 0),
        net: Number(kpi?.totalin || 0) - Number(kpi?.totalout || 0),
      },
      breakdown: {
        in: breakdownIn.map((b) => ({
          method: b.method || 'Khác',
          amount: Number(b.amount),
        })),
        out: breakdownOut.map((b) => ({
          method: b.method || 'Khác',
          amount: Number(b.amount),
        })),
      },
      trend: trend
        .map((t) => ({
          month: t.month,
          in: Number(t.in_amount),
          out: Number(t.out_amount),
        }))
        .reverse(),
    };
  }

  async listVouchers(
    query: ListKgaraCashflowVoucherQueryDto,
  ): Promise<{ data: KgaraCashflowVoucher[]; total: number }> {
    const qb = this.voucherRepo.createQueryBuilder('voucher');

    if (query.date_from) {
      qb.andWhere('voucher.transDate >= :date_from', {
        date_from: query.date_from,
      });
    }
    if (query.date_to) {
      qb.andWhere('voucher.transDate <= :date_to', { date_to: query.date_to });
    }
    if (query.voucher_type) {
      qb.andWhere('voucher.voucherType = :voucher_type', {
        voucher_type: query.voucher_type,
      });
    }
    if (query.case_id) {
      qb.andWhere('voucher.caseId = :case_id', { case_id: query.case_id });
    }

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    qb.orderBy('voucher.createdAt', 'DESC');
    qb.skip(skip).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCase } from '../entities/kgara_case.entity';
import { ErpBankTransaction } from '../../bank-transactions-core/entities/erp_bank_transaction.entity';
import { KgaraCaseSettlementCalcService } from './kgara-case-settlement-calc.service';
import {
  CreateGarageCashflowDto,
  UpdateGarageCashflowDto,
} from '../dto/create-garage-cashflow.dto';
import {
  GarageCashflowColumnOptionsQueryDto,
  GarageCashflowItemDto,
  GarageCashflowListResponseDto,
  GarageCashflowQueryDto,
} from '../dto/garage-cashflow-query.dto';
import {
  calculateCashflowStats,
  sanitizePaymentMethod,
} from '../engines/garage-cashflow-calc.engine';
import {
  applyGarageCashflowFilters,
  applyGarageCashflowSorts,
  queryGarageCashflowDistinctOptions,
} from '../helpers/garage-cashflow-filter.helper';

@Injectable()
export class GarageCashflowService {
  constructor(
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(ErpBankTransaction)
    private readonly bankTxnRepo: Repository<ErpBankTransaction>,
    private readonly settlementCalcService: KgaraCaseSettlementCalcService,
  ) {}

  async listCashflow(
    query: GarageCashflowQueryDto,
  ): Promise<GarageCashflowListResponseDto> {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
    const skip = (page - 1) * pageSize;

    const qb = this.settlementRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.case', 'c')
      .leftJoinAndSelect('s.bankTransaction', 'bt');

    if (query.search) {
      qb.andWhere(
        '(s.partnerName ILIKE :search OR s.note ILIKE :search OR c.soChungTu ILIKE :search OR c.bienSoXe ILIKE :search OR bt.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.settlementType) {
      qb.andWhere('s.settlementType = :st', { st: query.settlementType });
    }

    if (query.paymentMethod) {
      qb.andWhere('s.paymentMethod = :pm', { pm: query.paymentMethod });
    }

    if (query.caseCode) {
      qb.andWhere('c.soChungTu ILIKE :caseCode', {
        caseCode: `%${query.caseCode}%`,
      });
    }

    if (query.licensePlate) {
      qb.andWhere('c.bienSoXe ILIKE :plate', {
        plate: `%${query.licensePlate}%`,
      });
    }

    if (query.partnerName) {
      qb.andWhere('s.partnerName ILIKE :pname', {
        pname: `%${query.partnerName}%`,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('s.transDate >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('s.transDate <= :dateTo', { dateTo: query.dateTo });
    }

    // Áp dụng filtersStr đa chiều và statusTab
    applyGarageCashflowFilters(qb, query.filtersStr, query.statusTab);

    // Áp dụng sorts hoặc sortField / sortOrder
    applyGarageCashflowSorts(qb, query.sorts, query.sortField, query.sortOrder);

    // Get stats from all filtered items
    const statsQb = qb.clone();
    statsQb.offset(undefined).limit(undefined);
    const rawItemsForStats = await statsQb
      .select(['s.settlementType', 's.amount', 's.caseId'])
      .getMany();
    const stats = calculateCashflowStats(rawItemsForStats);

    // Get paginated items
    const [entities, total] = await qb
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const items: GarageCashflowItemDto[] = entities.map((e) =>
      this.mapEntityToItemDto(e),
    );

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats,
    };
  }

  async getColumnOptions(
    query?: GarageCashflowColumnOptionsQueryDto,
  ): Promise<any> {
    const targetCol = query?.column || query?.columnKey;
    if (targetCol) {
      return queryGarageCashflowDistinctOptions(this.settlementRepo, {
        column: targetCol,
        search: query?.search,
        page: query?.page,
        pageSize: query?.pageSize,
        filtersStr: query?.filtersStr,
        statusTab: query?.statusTab,
      });
    }

    return {
      settlementTypes: [
        { label: 'Thu tiền (RECEIPT)', value: 'RECEIPT' },
        { label: 'Chi tiền (PAYMENT)', value: 'PAYMENT' },
      ],
      paymentMethods: [
        { label: 'Chuyển khoản (BANK_TRANSFER)', value: 'BANK_TRANSFER' },
        { label: 'Tiền mặt (CASH)', value: 'CASH' },
        { label: 'Quẹt thẻ (POS)', value: 'POS' },
        { label: 'Khác (OTHER)', value: 'OTHER' },
      ],
      payerTypes: [
        { label: 'Khách hàng (KH)', value: 'KH' },
        { label: 'Bảo hiểm (BH)', value: 'BH' },
        { label: 'Nhà cung cấp / Gia công (SUPPLIER)', value: 'SUPPLIER' },
        { label: 'Khác (OTHER)', value: 'OTHER' },
      ],
      sourceChannels: [
        { label: 'Đã liên kết Sao kê (ON_SYSTEM)', value: 'ON_SYSTEM' },
        {
          label: 'Ghi nhận ngoài hệ thống (OFF_SYSTEM_MANUAL)',
          value: 'OFF_SYSTEM_MANUAL',
        },
      ],
    };
  }

  async createCashflow(
    dto: CreateGarageCashflowDto,
  ): Promise<GarageCashflowItemDto> {
    const paymentMethod = sanitizePaymentMethod(
      dto.paymentMethod,
      Boolean(dto.bankTransactionId),
    );

    const sourceChannel =
      dto.bankTransactionId || paymentMethod === 'BANK_TRANSFER'
        ? 'ON_SYSTEM'
        : 'OFF_SYSTEM_MANUAL';

    const entity = this.settlementRepo.create({
      caseId: dto.caseId || undefined,
      bankTransactionId: dto.bankTransactionId || undefined,
      settlementType: dto.settlementType,
      paymentMethod,
      sourceChannel,
      amount: Math.abs(Number(dto.amount || 0)),
      transDate: dto.transDate,
      partnerName: dto.partnerName,
      payerType: dto.payerType || 'KH',
      receiptNumber: dto.receiptNumber,
      category: dto.category,
      note: dto.note,
    });

    const saved = await this.settlementRepo.save(entity);

    if (saved.caseId) {
      await this.settlementCalcService.recalculateCaseSettlementSummary(
        saved.caseId,
      );
    }

    const reloaded = await this.settlementRepo.findOne({
      where: { id: saved.id },
      relations: ['case', 'bankTransaction'],
    });

    return this.mapEntityToItemDto(reloaded || saved);
  }

  async updateCashflow(
    id: string,
    dto: UpdateGarageCashflowDto,
  ): Promise<GarageCashflowItemDto> {
    const existing = await this.settlementRepo.findOne({
      where: { id },
      relations: ['case'],
    });
    if (!existing) {
      throw new NotFoundException(`Khoản thu chi #${id} không tồn tại`);
    }

    const prevCaseId = existing.caseId;

    if (dto.settlementType !== undefined)
      existing.settlementType = dto.settlementType;
    if (dto.amount !== undefined)
      existing.amount = Math.abs(Number(dto.amount || 0));
    if (dto.transDate !== undefined) existing.transDate = dto.transDate;
    if (dto.partnerName !== undefined) existing.partnerName = dto.partnerName;
    if (dto.payerType !== undefined) existing.payerType = dto.payerType;
    if (dto.receiptNumber !== undefined)
      existing.receiptNumber = dto.receiptNumber;
    if (dto.category !== undefined) existing.category = dto.category;
    if (dto.note !== undefined) existing.note = dto.note;
    if (dto.caseId !== undefined) existing.caseId = dto.caseId || undefined;
    if (dto.bankTransactionId !== undefined) {
      existing.bankTransactionId = dto.bankTransactionId || undefined;
    }
    if (dto.paymentMethod !== undefined) {
      existing.paymentMethod = sanitizePaymentMethod(
        dto.paymentMethod,
        Boolean(existing.bankTransactionId),
      );
    }

    const updated = await this.settlementRepo.save(existing);

    if (prevCaseId && prevCaseId !== updated.caseId) {
      await this.settlementCalcService.recalculateCaseSettlementSummary(
        prevCaseId,
      );
    }
    if (updated.caseId) {
      await this.settlementCalcService.recalculateCaseSettlementSummary(
        updated.caseId,
      );
    }

    const reloaded = await this.settlementRepo.findOne({
      where: { id: updated.id },
      relations: ['case', 'bankTransaction'],
    });

    return this.mapEntityToItemDto(reloaded || updated);
  }

  async deleteCashflow(id: string): Promise<{ success: boolean }> {
    const existing = await this.settlementRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Khoản thu chi #${id} không tồn tại`);
    }

    const caseId = existing.caseId;
    await this.settlementRepo.delete(id);

    if (caseId) {
      await this.settlementCalcService.recalculateCaseSettlementSummary(caseId);
    }

    return { success: true };
  }

  private mapEntityToItemDto(
    entity: KgaraCaseSettlement,
  ): GarageCashflowItemDto {
    const c = entity.case;
    const bt = entity.bankTransaction;

    return {
      id: entity.id,
      transDate: entity.transDate || undefined,
      settlementType: entity.settlementType,
      sourceChannel: entity.sourceChannel,
      paymentMethod: entity.paymentMethod || 'BANK_TRANSFER',
      amount: Number(entity.amount || 0),
      partnerName: entity.partnerName || undefined,
      payerType: entity.payerType,
      receiptNumber: entity.receiptNumber || undefined,
      category: entity.category || undefined,
      note: entity.note || undefined,
      caseId: entity.caseId || undefined,
      caseCode: c?.soChungTu || undefined,
      licensePlate: c?.bienSoXe || undefined,
      bankTransactionId: entity.bankTransactionId || undefined,
      bankTransaction: bt
        ? {
            id: bt.id,
            transDate: bt.transDate ? String(bt.transDate) : undefined,
            amount: Number(bt.creditAmount || bt.debitAmount || 0),
            description: bt.description || undefined,
            correspondentName: bt.correspondentName || undefined,
          }
        : undefined,
      caseSummary: c
        ? {
            id: c.id,
            soChungTu: c.soChungTu || '',
            bienSoXe: c.bienSoXe || undefined,
            tenKhachHang: c.khachHangName || undefined,
            tienCoThue: Number(c.tienCoThue || 0),
            tienDaThanhToan: Number(c.tienDaThanhToan || 0),
            tienConPhaiThanhToan: Number(c.tienConPhaiThanhToan || 0),
          }
        : undefined,
      createdAt: entity.createdAt
        ? entity.createdAt.toISOString()
        : new Date().toISOString(),
      updatedAt: entity.updatedAt
        ? entity.updatedAt.toISOString()
        : new Date().toISOString(),
    };
  }
}

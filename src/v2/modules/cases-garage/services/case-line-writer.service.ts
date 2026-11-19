import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { CaseServiceLineDto } from '../dto/case-service-line.dto';
import { CaseServiceGarage } from '../entities/case-service-garage.entity';
import { CaseGarage } from '../entities/case-garage.entity';
import { assertValidExtraData } from '@/v2/core/base-core/helpers/extra-data.util';
import {
  computeCaseTotals,
  computeLineAmounts,
} from '../helpers/case-totals.helper';

const num = (v: number | undefined) => (v == null ? null : v.toFixed(4));
const money = (v: number | undefined) => (v == null ? null : v.toFixed(2));

/** Ghi dòng hạng mục của xe NATIVE và tính lại tổng header trong cùng transaction. */
@Injectable()
export class CaseLineWriter {
  private toEntity(
    m: EntityManager,
    caseId: string,
    accountKey: string,
    dto: CaseServiceLineDto,
    index: number,
  ): CaseServiceGarage {
    if (dto.extraData !== undefined) assertValidExtraData(dto.extraData);
    return m.create(CaseServiceGarage, {
      caseId,
      accountKey,
      lineNumber: dto.lineNumber ?? index + 1,
      description: dto.description ?? null,
      productCode: dto.productCode ?? null,
      productName: dto.productName ?? null,
      productTypeCode: dto.productTypeCode ?? null,
      unitName: dto.unitName ?? null,
      quantity: num(dto.quantity),
      unitPrice: money(dto.unitPrice),
      taxRate: money(dto.taxRate),
      laborHours: money(dto.laborHours),
      partsCost: money(dto.partsCost),
      lineDiscountAmount: money(dto.lineDiscountAmount),
      surchargeAmount: money(dto.surchargeAmount),
      warehouseCode: dto.warehouseCode ?? null,
      extraData: dto.extraData ?? {},
      ...computeLineAmounts(dto),
    });
  }

  /** Thay toàn bộ dòng (xóa cứng dòng cũ của xe NATIVE) rồi tính lại tổng. */
  async replaceAll(
    m: EntityManager,
    header: Pick<CaseGarage, 'id' | 'accountKey'>,
    dtos: CaseServiceLineDto[],
  ): Promise<void> {
    await m.delete(CaseServiceGarage, { caseId: header.id });
    const rows = dtos.map((d, i) =>
      this.toEntity(m, header.id, header.accountKey, d, i),
    );
    if (rows.length) await m.save(CaseServiceGarage, rows);
    await this.recompute(m, header.id);
  }

  async add(
    m: EntityManager,
    header: Pick<CaseGarage, 'id' | 'accountKey'>,
    dto: CaseServiceLineDto,
  ): Promise<CaseServiceGarage> {
    const count = await m.count(CaseServiceGarage, {
      where: { caseId: header.id },
    });
    const saved = await m.save(
      CaseServiceGarage,
      this.toEntity(m, header.id, header.accountKey, dto, count),
    );
    await this.recompute(m, header.id);
    return saved;
  }

  async findLine(
    m: EntityManager,
    caseId: string,
    lineId: string,
  ): Promise<CaseServiceGarage> {
    const line = await m.findOne(CaseServiceGarage, {
      where: { id: lineId, caseId },
    });
    if (!line) throw new NotFoundException('Không tìm thấy dòng hạng mục.');
    return line;
  }

  async replaceOne(
    m: EntityManager,
    header: Pick<CaseGarage, 'id' | 'accountKey'>,
    lineId: string,
    dto: CaseServiceLineDto,
  ): Promise<CaseServiceGarage> {
    const line = await this.findLine(m, header.id, lineId);
    const next = this.toEntity(
      m,
      header.id,
      header.accountKey,
      dto,
      line.lineNumber - 1,
    );
    next.id = line.id;
    next.lineNumber = dto.lineNumber ?? line.lineNumber;
    const saved = await m.save(CaseServiceGarage, next);
    await this.recompute(m, header.id);
    return saved;
  }

  async remove(
    m: EntityManager,
    caseId: string,
    lineId: string,
  ): Promise<void> {
    const line = await this.findLine(m, caseId, lineId);
    await m.delete(CaseServiceGarage, { id: line.id });
    await this.recompute(m, caseId);
  }

  /** Tính lại tổng header từ các dòng. `paid` giữ nguyên số đã lưu. */
  async recompute(m: EntityManager, caseId: string): Promise<void> {
    const header = await m.findOne(CaseGarage, { where: { id: caseId } });
    if (!header) throw new BadRequestException('Vụ việc không tồn tại.');
    const lines = await m.find(CaseServiceGarage, { where: { caseId } });
    await m.update(
      CaseGarage,
      { id: caseId },
      computeCaseTotals(lines, header.paidAmount) as never,
    );
  }
}

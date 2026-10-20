import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';
import {
  CreateGarageOpexDto,
  UpdateGarageOpexDto,
  ListGarageOpexQueryDto,
} from '../dto/garage-opex.dto';
import {
  applyOpexListFilters,
  applyOpexListSorting,
  buildOpexColumnOptionsQuery,
  COGS_GROUP_CATEGORIES,
  SELLING_COMMISSION_CATEGORIES,
} from '../helpers/garage-opex-query.builder';

@Injectable()
export class GarageOpexService {
  constructor(
    @InjectRepository(KgaraOperatingExpense)
    private readonly opexRepo: Repository<KgaraOperatingExpense>,
  ) {}

  /**
   * Lấy danh sách chi phí vận hành có phân trang, sort và server-side filtering
   */
  async getList(query: ListGarageOpexQueryDto) {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.max(Number(query.pageSize) || 20, 1);

    const qb = this.opexRepo.createQueryBuilder('opex');

    applyOpexListFilters(qb, query);
    applyOpexListSorting(qb, query.sorts);

    const [rawItems, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const data = rawItems.map((item) => ({
      ...item,
      amount: Number(item.amount) || 0,
      ojAmount: Number(item.ojAmount) || 0,
      period: `${String(item.periodMonth).padStart(2, '0')}/${item.periodYear}`,
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Lấy distinct values cho bộ lọc header cột
   */
  async getColumnOptions(
    columnKey: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safePageSize = Math.max(Number(pageSize) || 20, 1);

    const qb = this.opexRepo.createQueryBuilder('opex');
    const { fieldAlias } = buildOpexColumnOptionsQuery(
      qb,
      columnKey,
      search,
      filtersStr,
    );

    const allOptions = await qb.getRawMany();
    const values = allOptions
      .map((r) => r[fieldAlias])
      .filter((v) => v !== null && v !== undefined && v !== '');

    const total = values.length;
    const paginated = values.slice(
      (safePage - 1) * safePageSize,
      safePage * safePageSize,
    );

    return {
      data: paginated,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async getById(id: string) {
    const item = await this.opexRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Chi phí vận hành ${id} không tồn tại`);
    }
    return {
      ...item,
      amount: Number(item.amount) || 0,
      ojAmount: Number(item.ojAmount) || 0,
      period: `${String(item.periodMonth).padStart(2, '0')}/${item.periodYear}`,
    };
  }

  async create(dto: CreateGarageOpexDto, userId?: string) {
    if (
      dto.categoryKey === 'HOA_HONG_SALE' ||
      dto.categoryKey === 'HOA_HONG_DV'
    ) {
      throw new BadRequestException(
        'Hoa hồng Sale và Hoa hồng Dịch vụ được hệ thống tự động tính toán từ P&L, không thể tạo thủ công. Vui lòng sử dụng mục "Hoa hồng khác" để điều chỉnh tăng/giảm.',
      );
    }

    const item = this.opexRepo.create({
      periodYear: Number(dto.periodYear),
      periodMonth: Number(dto.periodMonth),
      categoryKey: dto.categoryKey,
      categoryName: dto.categoryName,
      amount: Number(dto.amount) || 0,
      ojAmount: Number(dto.ojAmount) || 0,
      note: dto.note || null,
      recurrenceType: dto.recurrenceType || null,
      recurrenceUntilYear: dto.recurrenceUntilYear
        ? Number(dto.recurrenceUntilYear)
        : null,
      recurrenceUntilMonth: dto.recurrenceUntilMonth
        ? Number(dto.recurrenceUntilMonth)
        : null,
      recurrenceAnchorId: dto.recurrenceAnchorId || null,
      createdBy: userId || null,
    });
    const saved = await this.opexRepo.save(item);

    // If recurring was configured upon creation with an until period, generate future months
    if (
      saved.recurrenceType === 'monthly' &&
      saved.recurrenceUntilYear &&
      saved.recurrenceUntilMonth
    ) {
      await this.applyRecurring(
        saved.id,
        {
          applyScope: 'this_and_future',
          amount: Number(saved.amount),
          ojAmount: Number(saved.ojAmount) || 0,
          categoryKey: saved.categoryKey,
          categoryName: saved.categoryName,
          note: saved.note || undefined,
          recurrenceType: 'monthly',
          untilYear: saved.recurrenceUntilYear,
          untilMonth: saved.recurrenceUntilMonth,
        },
        userId,
      );
    }

    return {
      ...saved,
      amount: Number(saved.amount) || 0,
      ojAmount: Number(saved.ojAmount) || 0,
      period: `${String(saved.periodMonth).padStart(2, '0')}/${saved.periodYear}`,
    };
  }

  async update(id: string, dto: UpdateGarageOpexDto) {
    if (id.startsWith('auto-')) {
      throw new BadRequestException(
        'Hoa hồng tự động không thể chỉnh sửa trực tiếp. Vui lòng sử dụng mục "Hoa hồng khác" để điều chỉnh số tiền.',
      );
    }

    const item = await this.opexRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Chi phí vận hành ${id} không tồn tại`);
    }

    if (
      item.categoryKey === 'HOA_HONG_SALE' ||
      item.categoryKey === 'HOA_HONG_DV' ||
      dto.categoryKey === 'HOA_HONG_SALE' ||
      dto.categoryKey === 'HOA_HONG_DV'
    ) {
      throw new BadRequestException(
        'Hoa hồng Sale và Hoa hồng Dịch vụ được hệ thống tự động tính toán từ P&L, không thể chỉnh sửa trực tiếp. Vui lòng sử dụng mục "Hoa hồng khác" để điều chỉnh.',
      );
    }

    this.assertNotVoucherSourced(item);

    if (dto.periodYear !== undefined) item.periodYear = Number(dto.periodYear);
    if (dto.periodMonth !== undefined)
      item.periodMonth = Number(dto.periodMonth);
    if (dto.categoryKey !== undefined) item.categoryKey = dto.categoryKey;
    if (dto.categoryName !== undefined) item.categoryName = dto.categoryName;
    if (dto.amount !== undefined) item.amount = Number(dto.amount) || 0;
    if (dto.ojAmount !== undefined) item.ojAmount = Number(dto.ojAmount) || 0;
    if (dto.note !== undefined) item.note = dto.note || null;
    if (dto.recurrenceType !== undefined)
      item.recurrenceType = dto.recurrenceType || null;
    if (dto.recurrenceUntilYear !== undefined)
      item.recurrenceUntilYear = dto.recurrenceUntilYear
        ? Number(dto.recurrenceUntilYear)
        : null;
    if (dto.recurrenceUntilMonth !== undefined)
      item.recurrenceUntilMonth = dto.recurrenceUntilMonth
        ? Number(dto.recurrenceUntilMonth)
        : null;
    if (dto.recurrenceAnchorId !== undefined)
      item.recurrenceAnchorId = dto.recurrenceAnchorId || null;

    const updated = await this.opexRepo.save(item);
    return {
      ...updated,
      amount: Number(updated.amount) || 0,
      ojAmount: Number(updated.ojAmount) || 0,
      period: `${String(updated.periodMonth).padStart(2, '0')}/${updated.periodYear}`,
    };
  }

  /**
   * Áp dụng thay đổi định kỳ (Google Calendar style: this vs this_and_future)
   */
  async applyRecurring(
    id: string,
    dto: import('../dto/garage-opex.dto').ApplyRecurringOpexDto,
    userId?: string,
  ) {
    if (id.startsWith('auto-')) {
      throw new BadRequestException(
        'Hoa hồng tự động không hỗ trợ thiết lập chi phí định kỳ.',
      );
    }

    const item = await this.opexRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Chi phí vận hành ${id} không tồn tại`);
    }

    if (
      item.categoryKey === 'HOA_HONG_SALE' ||
      item.categoryKey === 'HOA_HONG_DV' ||
      dto.categoryKey === 'HOA_HONG_SALE' ||
      dto.categoryKey === 'HOA_HONG_DV'
    ) {
      throw new BadRequestException(
        'Hoa hồng tự động không hỗ trợ thiết lập chi phí định kỳ.',
      );
    }

    this.assertNotVoucherSourced(item);

    if (dto.amount !== undefined) item.amount = Number(dto.amount) || 0;
    if (dto.ojAmount !== undefined) item.ojAmount = Number(dto.ojAmount) || 0;
    if (dto.categoryKey !== undefined) item.categoryKey = dto.categoryKey;
    if (dto.categoryName !== undefined) item.categoryName = dto.categoryName;
    if (dto.note !== undefined) item.note = dto.note || null;
    if (dto.recurrenceType !== undefined)
      item.recurrenceType = dto.recurrenceType || null;
    if (dto.untilYear !== undefined)
      item.recurrenceUntilYear = dto.untilYear ? Number(dto.untilYear) : null;
    if (dto.untilMonth !== undefined)
      item.recurrenceUntilMonth = dto.untilMonth
        ? Number(dto.untilMonth)
        : null;

    const saved = await this.opexRepo.save(item);

    if (dto.applyScope === 'this') {
      return {
        updated: 1,
        created: 0,
        total: 1,
        item: {
          ...saved,
          amount: Number(saved.amount) || 0,
          ojAmount: Number(saved.ojAmount) || 0,
          period: `${String(saved.periodMonth).padStart(2, '0')}/${saved.periodYear}`,
        },
      };
    }

    // Apply for this and all future periods in recurrence range
    const anchorId = item.recurrenceAnchorId || item.id;
    let startYear = Number(item.periodYear);
    let startMonth = Number(item.periodMonth) + 1;
    if (startMonth > 12) {
      startMonth = 1;
      startYear += 1;
    }

    const endYear = dto.untilYear
      ? Number(dto.untilYear)
      : item.recurrenceUntilYear
        ? Number(item.recurrenceUntilYear)
        : item.periodYear + 1;
    const endMonth = dto.untilMonth
      ? Number(dto.untilMonth)
      : item.recurrenceUntilMonth
        ? Number(item.recurrenceUntilMonth)
        : item.periodMonth;

    const periods: Array<{ year: number; month: number }> = [];
    let curY = startYear;
    let curM = startMonth;
    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      periods.push({ year: curY, month: curM });
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    let updatedCount = 0;
    let createdCount = 0;

    for (const p of periods) {
      const existing = await this.opexRepo.findOne({
        where: {
          periodYear: p.year,
          periodMonth: p.month,
          categoryKey: item.categoryKey,
        },
      });

      if (existing) {
        existing.amount = item.amount;
        existing.ojAmount = item.ojAmount;
        existing.categoryName = item.categoryName;
        existing.note = item.note;
        existing.recurrenceType = item.recurrenceType;
        existing.recurrenceUntilYear = item.recurrenceUntilYear;
        existing.recurrenceUntilMonth = item.recurrenceUntilMonth;
        existing.recurrenceAnchorId = anchorId;
        await this.opexRepo.save(existing);
        updatedCount++;
      } else {
        const newItem = this.opexRepo.create({
          periodYear: p.year,
          periodMonth: p.month,
          categoryKey: item.categoryKey,
          categoryName: item.categoryName,
          amount: item.amount,
          ojAmount: item.ojAmount,
          note: item.note,
          recurrenceType: item.recurrenceType,
          recurrenceUntilYear: item.recurrenceUntilYear,
          recurrenceUntilMonth: item.recurrenceUntilMonth,
          recurrenceAnchorId: anchorId,
          createdBy: userId || null,
        });
        await this.opexRepo.save(newItem);
        createdCount++;
      }
    }

    return {
      updated: updatedCount + 1, // include current record
      created: createdCount,
      total: updatedCount + 1 + createdCount,
      item: {
        ...saved,
        amount: Number(saved.amount) || 0,
        ojAmount: Number(saved.ojAmount) || 0,
        period: `${String(saved.periodMonth).padStart(2, '0')}/${saved.periodYear}`,
      },
    };
  }

  async delete(id: string) {
    if (id.startsWith('auto-')) {
      throw new BadRequestException('Hoa hồng tự động không thể xóa.');
    }
    const item = await this.opexRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Chi phí vận hành ${id} không tồn tại`);
    }
    this.assertNotVoucherSourced(item);
    await this.opexRepo.remove(item);
    return { success: true, id };
  }

  /** Dòng opex sinh từ phiếu thu chi garage chỉ được sửa/xóa qua phiếu gốc. */
  private assertNotVoucherSourced(item: KgaraOperatingExpense) {
    if (item.sourceCashflowVoucherId) {
      throw new BadRequestException(
        'Khoản chi này được ghi nhận từ phiếu chi garage, vui lòng chỉnh sửa tại Thu chi garage.',
      );
    }
  }

  /**
   * Tổng hợp chi phí vận hành cho kỳ Year/Month (phục vụ P&L report)
   * Lưu ý: Tự động bỏ qua HOA_HONG_SALE và HOA_HONG_DV trong DB vì 2 khoản này tính động 100% từ P&L.
   */
  async getSummaryByPeriod(year: number, month: number) {
    const items = await this.opexRepo.find({
      where: {
        periodYear: year,
        periodMonth: month,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    const opexItems: Array<{
      id: string;
      categoryKey: string;
      categoryName: string;
      amount: number;
      ojAmount: number;
      note?: string | null;
    }> = [];

    const commissionItems: Array<{
      id: string;
      categoryKey: string;
      categoryName: string;
      amount: number;
      ojAmount: number;
      note?: string | null;
    }> = [];

    const sellingItems: Array<{
      id: string;
      categoryKey: string;
      categoryName: string;
      amount: number;
      ojAmount: number;
      note?: string | null;
    }> = [];

    const directCostItems: Array<{
      id: string;
      categoryKey: string;
      categoryName: string;
      amount: number;
      ojAmount: number;
      note?: string | null;
    }> = [];

    let totalOpex = 0;
    let ojTotalOpex = 0;
    let totalCommission = 0;
    let ojTotalCommission = 0;
    let totalDirectCost = 0;
    let ojTotalDirectCost = 0;
    let totalSelling = 0;
    let ojTotalSelling = 0;

    for (const item of items) {
      const amt = Number(item.amount) || 0;
      const ojAmt = Number(item.ojAmount) || 0;
      const row = {
        id: item.id,
        categoryKey: item.categoryKey,
        categoryName: item.categoryName,
        amount: amt,
        ojAmount: ojAmt,
        note: item.note,
      };

      // Bỏ qua HOA_HONG_SALE và HOA_HONG_DV cũ trong DB (nếu có từ trước)
      if (
        item.categoryKey === 'HOA_HONG_SALE' ||
        item.categoryKey === 'HOA_HONG_DV'
      ) {
        continue;
      }

      if (COGS_GROUP_CATEGORIES.includes(item.categoryKey)) {
        directCostItems.push(row);
        totalDirectCost += amt;
        ojTotalDirectCost += ojAmt;
      } else if (SELLING_COMMISSION_CATEGORIES.includes(item.categoryKey)) {
        sellingItems.push(row);
        totalSelling += amt;
        ojTotalSelling += ojAmt;
      } else if (item.categoryKey.startsWith('HOA_HONG_')) {
        commissionItems.push(row);
        totalCommission += amt;
        ojTotalCommission += ojAmt;
      } else {
        opexItems.push(row);
        totalOpex += amt;
        ojTotalOpex += ojAmt;
      }
    }

    return {
      directCost: {
        total: totalDirectCost,
        ojTotal: ojTotalDirectCost,
        items: directCostItems,
      },
      selling: {
        total: totalSelling,
        ojTotal: ojTotalSelling,
        items: sellingItems,
      },
      opex: {
        total: totalOpex,
        ojTotal: ojTotalOpex,
        items: opexItems,
      },
      commission: {
        total: totalCommission,
        ojTotal: ojTotalCommission,
        items: commissionItems,
      },
    };
  }
}

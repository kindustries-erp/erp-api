import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository, Not } from 'typeorm';
import { ErpOperatingExpense } from './entities/erp_operating_expense.entity';
import { CreateOperatingExpenseDto } from './dto/create-operating-expense.dto';
import { OperationalQueryDto } from '../operational-documents/dto/operational-document.dto';

@Injectable()
export class OperatingExpensesCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpOperatingExpense)
    private readonly repository: Repository<ErpOperatingExpense>,
  ) {}

  private async generateExpenseNo(manager: any, orderDate?: string) {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const year = baseDate.getUTCFullYear();
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const prefix = `EXP-${year}${month}-`;
    const latest = await manager
      .getRepository(ErpOperatingExpense)
      .createQueryBuilder('exp')
      .where('exp.expenseNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('exp.expenseNo', 'DESC')
      .getOne();
    const latestSeq = latest?.expenseNo?.slice(prefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  async create(dto: CreateOperatingExpenseDto) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ErpOperatingExpense);
      const expenseNo =
        dto.expense_no?.trim() ||
        (await this.generateExpenseNo(manager, dto.document_date));
      const payload: DeepPartial<ErpOperatingExpense> = {
        expenseNo,
        branchId: dto.branch_id ?? null,
        supplierId: dto.supplier_id ?? null,
        supplierNameSnapshot: dto.supplier_name_snapshot ?? null,
        expenseCategory: dto.expense_category ?? null,
        title: dto.title ?? null,
        documentDate: dto.document_date ?? null,
        dueDate: dto.due_date ?? null,
        invoiceStatus: dto.invoice_status ?? 'NOT_REQUIRED',
        status: dto.status ?? 'DRAFT',
        paymentStatus: 'UNPAID', // Default initial state
        totalAmount: dto.total_amount ?? 0,
        recurrenceType: dto.recurrence_type ?? 'ONE_TIME',
        recurrenceInterval: dto.recurrence_interval ?? 1,
        recurrenceStartDate: dto.recurrence_start_date ?? null,
        recurrenceEndDate: dto.recurrence_end_date ?? null,
        nextDueDate: dto.next_due_date ?? null,
        autoGenerateNext: dto.auto_generate_next ?? false,
        parentRecurringId: dto.parent_recurring_id ?? null,
        notes: dto.notes ?? null,
      };
      const data = await repo.save(payload);
      return { message: 'Tạo khoản chi thành công', data };
    });
  }

  async findAll(query: OperationalQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const qb = this.repository.createQueryBuilder('exp');

    qb.where('exp.isDeleted = false');

    if (query.branch_id) {
      qb.andWhere('exp.branchId = :branchId', { branchId: query.branch_id });
    }
    if (query.status) {
      qb.andWhere('exp.status = :status', { status: query.status });
    }
    if (query.payment_status) {
      qb.andWhere('exp.paymentStatus = :paymentStatus', {
        paymentStatus: query.payment_status,
      });
    }
    if (query.search) {
      qb.andWhere('(exp.expenseNo ILIKE :search OR exp.title ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('exp.documentDate', 'DESC');
    qb.addOrderBy('exp.createdAt', 'DESC');

    const [data, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data,
      meta: {
        filter_count: total,
      },
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!data) throw new NotFoundException('Không tìm thấy khoản chi');
    return { data };
  }

  async update(id: string, dto: any) {
    const record = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!record) throw new NotFoundException('Không tìm thấy khoản chi');

    // Map DTO snake_case to entity camelCase manually
    if (dto.expense_no !== undefined) record.expenseNo = dto.expense_no;
    if (dto.branch_id !== undefined) record.branchId = dto.branch_id;
    if (dto.supplier_id !== undefined) record.supplierId = dto.supplier_id;
    if (dto.supplier_name_snapshot !== undefined)
      record.supplierNameSnapshot = dto.supplier_name_snapshot;
    if (dto.expense_category !== undefined)
      record.expenseCategory = dto.expense_category;
    if (dto.title !== undefined) record.title = dto.title;
    if (dto.document_date !== undefined)
      record.documentDate = dto.document_date;
    if (dto.due_date !== undefined) record.dueDate = dto.due_date;
    if (dto.invoice_status !== undefined)
      record.invoiceStatus = dto.invoice_status;
    if (dto.status !== undefined) record.status = dto.status;
    if (dto.total_amount !== undefined) record.totalAmount = dto.total_amount;
    if (dto.recurrence_type !== undefined)
      record.recurrenceType = dto.recurrence_type;
    if (dto.recurrence_interval !== undefined)
      record.recurrenceInterval = dto.recurrence_interval;
    if (dto.recurrence_start_date !== undefined)
      record.recurrenceStartDate = dto.recurrence_start_date;
    if (dto.recurrence_end_date !== undefined)
      record.recurrenceEndDate = dto.recurrence_end_date;
    if (dto.next_due_date !== undefined) record.nextDueDate = dto.next_due_date;
    if (dto.auto_generate_next !== undefined)
      record.autoGenerateNext = dto.auto_generate_next;
    if (dto.notes !== undefined) record.notes = dto.notes;

    const updated = await this.repository.save(record);
    return { message: 'Cập nhật khoản chi thành công', data: updated };
  }

  async softDelete(id: string) {
    const record = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!record) throw new NotFoundException('Không tìm thấy khoản chi');
    record.isDeleted = true;
    await this.repository.save(record);
    return { message: 'Xóa khoản chi thành công' };
  }

  async findUnpaid() {
    return this.repository.find({
      where: {
        isDeleted: false,
        paymentStatus: Not('PAID'),
        status: Not('CANCELLED'),
      },
    });
  }

  async findRecurring() {
    return this.repository.find({
      where: {
        isDeleted: false,
        autoGenerateNext: true,
        status: Not('CANCELLED'),
      },
    });
  }
}

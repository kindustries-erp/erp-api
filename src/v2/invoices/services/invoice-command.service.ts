import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { toInvoiceEntityFields } from '../helpers/invoice.mapper';
import {
  primaryBranchId,
  resolveBranchIds,
  sameBranchIds,
} from '../helpers/invoice-branch.helper';
import { buildInvoiceItems } from '../helpers/invoice-items.helper';
import { extractInvoiceMetadata } from '../helpers/invoice-metadata.helper';
import { normalizeInvoiceNo } from '../helpers/invoice-no.helper';
import { INVOICE_MESSAGES } from '../invoice-messages';

/** Ghi dữ liệu: tạo, cập nhật, xóa mềm, và thao tác hàng loạt. Việc kiểm tra tồn tại do Facade đảm nhiệm. */
@Injectable()
export class InvoiceCommandService {
  constructor(
    @InjectRepository(Invoice)
    private readonly repo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
    private readonly dataSource: DataSource,
  ) {}

  /** Tạo hóa đơn và các dòng hàng trong cùng một transaction. */
  create(dto: CreateInvoiceDto, createdBy: string | null): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const branchIds = resolveBranchIds(dto) ?? [];
      const entity = manager.create(Invoice, {
        ...toInvoiceEntityFields(dto),
        branchIds,
        branchId: primaryBranchId(branchIds),
        invoiceNoNormalized: normalizeInvoiceNo(dto.invoiceNo),
        createdBy,
        isDeleted: false,
      });
      applyInvoiceMetadata(entity, dto.items ?? []);

      const saved = await manager.save(Invoice, entity);
      if (dto.items?.length) {
        const rows = buildInvoiceItems(dto.items, {
          direction: saved.direction,
          sellerName: saved.sellerName,
          sellerTaxCode: saved.sellerTaxCode,
        });
        await manager.save(
          InvoiceItem,
          rows.map((row) =>
            manager.create(InvoiceItem, { ...row, invoiceId: saved.id }),
          ),
        );
      }
      return saved;
    });
  }

  /**
   * Cập nhật một phần. Nếu gửi `items`, thay toàn bộ dòng hàng (xóa rồi tạo lại) và giữ mã cũ theo diễn giải.
   * Hóa đơn đã ghi sổ (POSTED) không đổi được chi nhánh (UC2 chưa port sang v2).
   */
  update(entity: Invoice, dto: UpdateInvoiceDto): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const nextBranchIds = resolveBranchIds(dto);
      if (
        nextBranchIds !== undefined &&
        !sameBranchIds(nextBranchIds, entity.branchIds ?? [])
      ) {
        if (entity.postingStatus === 'POSTED') {
          throw new BadRequestException(INVOICE_MESSAGES.BRANCH_LOCKED_POSTED);
        }
        entity.branchIds = nextBranchIds;
        entity.branchId = primaryBranchId(nextBranchIds);
      }

      Object.assign(entity, toInvoiceEntityFields(dto));
      if (dto.invoiceNo !== undefined) {
        entity.invoiceNoNormalized = normalizeInvoiceNo(dto.invoiceNo);
      }

      const existingItems = await manager.find(InvoiceItem, {
        where: { invoiceId: entity.id },
      });
      let itemsForMetadata: { description?: string | null }[] = existingItems;
      if (dto.items !== undefined) {
        const rows = buildInvoiceItems(
          dto.items,
          {
            direction: entity.direction,
            sellerName: entity.sellerName,
            sellerTaxCode: entity.sellerTaxCode,
          },
          existingItems,
        );
        await manager.delete(InvoiceItem, { invoiceId: entity.id });
        if (rows.length) {
          await manager.save(
            InvoiceItem,
            rows.map((row) =>
              manager.create(InvoiceItem, { ...row, invoiceId: entity.id }),
            ),
          );
        }
        itemsForMetadata = rows;
      }

      applyInvoiceMetadata(entity, itemsForMetadata);
      return manager.save(Invoice, entity);
    });
  }

  softDelete(entity: Invoice): Promise<Invoice> {
    entity.isDeleted = true;
    return this.repo.save(entity);
  }

  /**
   * Gán cùng một danh sách chi nhánh cho nhiều hóa đơn. Hóa đơn POSTED bị bỏ qua và trả về trong `skipped`.
   * Chi nhánh phải được kiểm tra tồn tại trước ở Facade.
   */
  async bulkSetBranch(
    ids: string[],
    branchIds: string[],
  ): Promise<{ updated: number; ids: string[]; skipped: string[] }> {
    if (ids.length === 0) return { updated: 0, ids: [], skipped: [] };

    const targets = await this.repo.find({
      where: { id: In(ids), isDeleted: false },
      select: ['id', 'postingStatus'],
    });
    const skipped = targets
      .filter((invoice) => invoice.postingStatus === 'POSTED')
      .map((invoice) => invoice.id);
    const updatable = targets
      .filter((invoice) => invoice.postingStatus !== 'POSTED')
      .map((invoice) => invoice.id);

    if (updatable.length) {
      await this.repo.update(
        { id: In(updatable) },
        { branchIds, branchId: primaryBranchId(branchIds) },
      );
    }
    return { updated: updatable.length, ids: updatable, skipped };
  }

  /** Đặt ghi chú cho nhiều hóa đơn. Chuỗi rỗng được lưu thành null. */
  async bulkSetNotes(
    ids: string[],
    notes: string | null,
  ): Promise<{ updated: number; ids: string[] }> {
    if (ids.length === 0) return { updated: 0, ids: [] };

    const targets = await this.repo.find({
      where: { id: In(ids), isDeleted: false },
      select: ['id'],
    });
    const validIds = targets.map((invoice) => invoice.id);
    if (validIds.length) {
      await this.repo.update({ id: In(validIds) }, { notes: notes || null });
    }
    return { updated: validIds.length, ids: validIds };
  }
}

/** Trích mã lệnh quyết toán và biển số từ diễn giải, ghi đè giá trị cũ khi có khớp. */
function applyInvoiceMetadata(
  entity: Invoice,
  items: { description?: string | null }[],
): void {
  const meta: {
    description: string | null;
    notes: string | null;
    settlementOrder: string | null;
    licensePlate: string | null;
    items: { description?: string | null }[];
  } = {
    description: entity.description,
    notes: entity.notes,
    settlementOrder: entity.settlementOrder,
    licensePlate: entity.licensePlate,
    items,
  };
  extractInvoiceMetadata(meta);
  entity.settlementOrder = meta.settlementOrder;
  entity.licensePlate = meta.licensePlate;
}

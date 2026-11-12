import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager, EntityTarget } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import {
  assertValidExtraData,
  mergeExtraData,
} from '@/v2/core/base-core/helpers/extra-data.util';
import {
  StockDirection,
  StockLedgerConfig,
  StockTransactionType,
  StockVoucherAction,
} from '../contracts/inventory-movements-core.contract';
import type { BaseCreateStockVoucherLineDto } from '../dto/base-stock-voucher-line.dto';
import { BaseStockVoucherEntity } from '../entities/base-stock-voucher.entity';
import { BaseStockVoucherLineEntity } from '../entities/lines/base-stock-voucher-line.entity';
import {
  fromCreateLineDto,
  toStockMoveLine,
} from '../helpers/stock-voucher.mapper';
import { StockMovementEngineService } from './stock-movement-engine.service';
import {
  AbstractStockVoucherCommandService,
  StockVoucherActor,
} from './abstract-stock-voucher-command.service';

/** Dữ liệu tạo/sửa chứng từ: phần đầu chứng từ và danh sách dòng (tùy chọn khi sửa). */
export interface StockVoucherDraftInput {
  lines?: BaseCreateStockVoucherLineDto[];
  [field: string]: unknown;
}

export interface StockLineVoucherHeader extends BaseStockVoucherEntity {
  voucherNo: string;
  voucherDate: Date;
  branchId?: string | null;
  totalAmount?: string | null;
}

/**
 * Nền nghiệp vụ chứng từ kho có dòng (nhập, xuất, điều chỉnh) trên lõi inventory-movements-core.
 * Lõi lo khóa header, chuyển trạng thái và nhật ký; lớp này lo dòng chứng từ và gọi engine tồn trong cùng transaction.
 * Module con chỉ khai báo: entity header, entity dòng, loại giao dịch, cấu hình sổ và chiều của dòng khi tạo.
 */
export abstract class AbstractStockLineVoucherCommandService<
  H extends StockLineVoucherHeader,
  L extends BaseStockVoucherLineEntity & { voucherId: string },
> extends AbstractStockVoucherCommandService<H> {
  protected abstract readonly lineEntity: EntityTarget<L>;
  protected abstract readonly transactionType: StockTransactionType;
  /** Sổ tồn mà chứng từ này ghi vào. */
  protected abstract readonly ledger: StockLedgerConfig;
  /** Chiều của một dòng khi tạo: cố định với nhập (IN) và xuất (OUT), lấy từ đầu vào với điều chỉnh. */
  protected abstract resolveDirection(
    dto: BaseCreateStockVoucherLineDto,
  ): StockDirection;

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    protected readonly engine: StockMovementEngineService,
  ) {
    super(dataSource, events);
  }

  /** Tạo nháp: header và dòng trong một transaction. */
  override async createDraft(
    actor: StockVoucherActor,
    data: object,
  ): Promise<H> {
    const { lines = [], extraData, ...header } = data as StockVoucherDraftInput;
    this.assertExtraData(extraData, lines as BaseCreateStockVoucherLineDto[]);
    return this.dataSource.transaction(async (manager) => {
      const entity = manager.create(this.headerEntity, {
        ...header,
        status: this.initialStatus,
        createdBy: actor.id,
        isDeleted: false,
        extraData: (extraData as Record<string, unknown> | undefined) ?? {},
      } as DeepPartial<H>);
      const saved = await manager.save(this.headerEntity, entity);
      await this.replaceLines(
        manager,
        saved,
        lines as BaseCreateStockVoucherLineDto[],
      );
      return manager.save(this.headerEntity, saved);
    });
  }

  /** Sửa nháp: chỉ khi còn DRAFT. Dòng được thay toàn bộ nếu có gửi lên. */
  async updateDraft(
    id: string,
    data: {
      lines?: BaseCreateStockVoucherLineDto[];
      extraData?: Record<string, unknown>;
    } & object,
  ): Promise<H> {
    const { lines, extraData, ...header } = data as StockVoucherDraftInput;
    this.assertExtraData(extraData, lines);
    return this.dataSource.transaction(async (manager) => {
      const voucher = await this.lockHeader(manager, id);
      if (voucher.status !== 'DRAFT') {
        throw new ConflictException('Chỉ sửa được chứng từ ở trạng thái nháp');
      }
      Object.assign(voucher, header);
      if (extraData !== undefined) {
        voucher.extraData = mergeExtraData(
          voucher.extraData,
          extraData as Record<string, unknown>,
        );
      }
      if (lines !== undefined) {
        await this.replaceLines(manager, voucher, lines);
      }
      return manager.save(this.headerEntity, voucher);
    });
  }

  /** Xóa mềm: chỉ khi còn DRAFT. Chứng từ đã ghi sổ chỉ được hủy bằng transition, không xóa. */
  async softDelete(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const voucher = await this.lockHeader(manager, id);
      if (voucher.status !== 'DRAFT') {
        throw new ConflictException('Chỉ xóa được chứng từ ở trạng thái nháp');
      }
      voucher.isDeleted = true;
      await manager.save(this.headerEntity, voucher);
    });
  }

  /** Ghi sổ: cộng/trừ tồn theo dòng. Hủy: đảo đúng các bút toán đã ghi. */
  protected override async beforeTransition(
    manager: EntityManager,
    header: H,
    action: StockVoucherAction,
    actor: StockVoucherActor,
  ): Promise<void> {
    const ctx = {
      branchId: header.branchId ?? null,
      documentType: this.docType,
      documentId: header.id,
      transactionDate: header.voucherDate,
      createdBy: actor.id,
    };

    if (action === 'cancel') {
      await this.engine.reverse(manager, this.ledger, ctx);
      return;
    }

    const lines = (await manager.getRepository(this.lineEntity).find({
      where: { voucherId: header.id } as never,
      order: { lineNo: 'ASC' } as never,
    })) as unknown as L[];
    if (lines.length === 0) {
      throw new BadRequestException('Chứng từ chưa có dòng nào');
    }

    const posted = await this.engine.post(
      manager,
      this.ledger,
      ctx,
      lines.map((line) => toStockMoveLine(line, this.transactionType)),
    );

    let total = 0;
    lines.forEach((line, index) => {
      // Dòng xuất lưu giá vốn đã tính để hiển thị và để đảo sổ đúng giá.
      if (line.direction === 'OUT') {
        line.unitCost = String(posted[index].appliedUnitCost);
      }
      line.amount = String(Number(line.qty) * Number(line.unitCost ?? 0));
      total += Number(line.amount);
    });
    await manager.save(this.lineEntity, lines);
    header.totalAmount = String(total);
  }

  /** Kiểm `extraData` của header và các dòng trước khi ghi. Giá trị sai định dạng bị chặn 400. */
  private assertExtraData(
    header: unknown,
    lines: BaseCreateStockVoucherLineDto[] | undefined,
  ): void {
    if (header !== undefined) {
      assertValidExtraData(header);
    }
    lines?.forEach((l) => {
      if (l.extraData !== undefined) assertValidExtraData(l.extraData);
    });
  }

  /**
   * CUSTOM: chuẩn bị dòng trước khi ghi, trong cùng transaction (ví dụ chuẩn hóa mã hàng theo danh mục).
   * Không đổi số lượng hay giá. Mặc định trả nguyên dòng.
   */
  protected prepareLines(
    _manager: EntityManager,
    lines: BaseCreateStockVoucherLineDto[],
  ): Promise<BaseCreateStockVoucherLineDto[]> {
    return Promise.resolve(lines);
  }

  /** Thay toàn bộ dòng của phiếu nháp và cập nhật tổng tiền trên header. */
  private async replaceLines(
    manager: EntityManager,
    voucher: H,
    input: BaseCreateStockVoucherLineDto[],
  ): Promise<void> {
    const lines = await this.prepareLines(manager, input);
    const repo = manager.getRepository(this.lineEntity);
    await repo.delete({ voucherId: voucher.id } as never);

    let total = 0;
    let lineNo = 1;
    for (const dto of lines) {
      const direction = this.resolveDirection(dto);
      if (
        direction === 'IN' &&
        (dto.unitCost === undefined || dto.unitCost === null)
      ) {
        throw new BadRequestException(
          `Dòng nhập ${dto.itemCode} thiếu giá nhập`,
        );
      }
      const row = fromCreateLineDto(dto, lineNo++, direction);
      await repo.save(
        repo.create({
          ...row,
          voucherId: voucher.id,
          extraData: dto.extraData ?? {},
        } as never),
      );
      total += Number(row.amount ?? 0);
    }
    voucher.totalAmount = String(total);
  }
}

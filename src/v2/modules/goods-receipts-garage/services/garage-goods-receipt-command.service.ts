import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '../entities/garage-goods-receipt-line.entity';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { UpdateGarageGoodsReceiptDto } from '../dto/update-garage-goods-receipt.dto';
import { toGarageGoodsReceiptEntityFields } from '../helpers/garage-goods-receipt.mapper';
import {
  assertOrderUnchanged,
  loadOrderForNewReceipt,
  receiptFieldsFromOrder,
  stripOrderOwnedFields,
} from '../helpers/garage-receipt-order.helper';
import { runInOptionalTransaction } from '@/v2/core/base-core/helpers/run-in-optional-transaction.util';
import {
  assertValidExtraData,
  mergeExtraData,
} from '@/v2/core/base-core/helpers/extra-data.util';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts-core/services/base-voucher-engine.service';
import { GarageProcurementFlowService } from '@/v2/modules/procurement-flow-garage/services/garage-procurement-flow.service';

@Injectable()
export class GarageGoodsReceiptCommandService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GarageGoodsReceipt)
    private readonly repo: Repository<GarageGoodsReceipt>,
    private readonly voucherEngine: BaseVoucherEngineService,
    private readonly flow: GarageProcurementFlowService,
  ) {}

  async generateDailyReceiptNo(orderDate?: string): Promise<string> {
    return this.voucherEngine.generateDailyVoucherNo(
      this.repo,
      'receiptNo',
      'GGR',
      orderDate,
    );
  }

  async create(
    dto: CreateGarageGoodsReceiptDto,
    outerManager?: EntityManager,
  ): Promise<GarageGoodsReceipt> {
    this.assertExtraData(dto.extraData, dto.lines);
    return runInOptionalTransaction(
      this.dataSource,
      outerManager,
      async (manager) => {
        const receiptRepo = manager.getRepository(GarageGoodsReceipt);
        const lineRepo = manager.getRepository(GarageGoodsReceiptLine);

        const receiptNo =
          dto.receiptNo?.trim() ||
          (await this.generateDailyReceiptNo(dto.receiptDate));

        const { lines = [], ...rawHeader } = dto;
        // Phiếu gắn đơn mua: NCC, chi nhánh lấy từ đơn, tổng tiền tính từ dòng (không tin client)
        const order = rawHeader.garageProcurementOrderId
          ? await loadOrderForNewReceipt(
              manager,
              rawHeader.garageProcurementOrderId,
            )
          : null;
        const headerDto = order
          ? {
              ...stripOrderOwnedFields(rawHeader),
              ...receiptFieldsFromOrder(order),
            }
          : rawHeader;
        const entityFields = toGarageGoodsReceiptEntityFields({
          ...(headerDto as typeof rawHeader),
          receiptNo,
          status: headerDto.status || 'DRAFT',
          paymentStatus: headerDto.paymentStatus || 'UNPAID',
        });

        // Calculate total from lines using core voucher engine
        const lineEntities: GarageGoodsReceiptLine[] = [];
        let lineNo = 1;
        for (const l of lines) {
          const qty = Number(l.qtyReceived || 0);
          const cost = Number(l.unitCost || 0);
          const amount = l.amount !== undefined ? Number(l.amount) : qty * cost;

          const line = lineRepo.create({
            lineNo: lineNo++,
            itemCode: l.itemCode ?? undefined,
            itemName: l.itemName,
            unit: l.unit || 'Cái',
            qtyReceived: String(qty),
            unitCost: String(cost),
            amount: String(amount),
            notes: l.notes ?? undefined,
            procurementOrderLineId: l.procurementOrderLineId ?? null,
            extraData: l.extraData ?? {},
          });
          lineEntities.push(line);
        }

        const calculatedTotal = this.voucherEngine.sumLineAmounts(lineEntities);

        if (order) {
          entityFields.totalAmount = String(calculatedTotal);
        } else if (dto.totalAmount !== undefined && dto.totalAmount !== null) {
          entityFields.totalAmount = String(dto.totalAmount);
        } else if (lineEntities.length > 0) {
          entityFields.totalAmount = String(calculatedTotal);
        }

        const receipt = receiptRepo.create({
          ...entityFields,
          isDeleted: false,
          extraData: dto.extraData ?? {},
        });
        const savedReceipt = await receiptRepo.save(receipt);

        for (const line of lineEntities) {
          line.garageGoodsReceiptId = savedReceipt.id;
          await lineRepo.save(line);
        }

        savedReceipt.lines = lineEntities;
        return savedReceipt;
      },
    );
  }

  /**
   * Sửa phiếu nháp. Khóa phiếu (pessimistic_write) rồi mới kiểm trạng thái trên bản đã khóa,
   * để không sửa dòng sau khi một lần post đồng thời đã chuyển phiếu sang POSTED.
   */
  async update(
    entity: GarageGoodsReceipt,
    dto: UpdateGarageGoodsReceiptDto,
    outerManager?: EntityManager,
  ): Promise<GarageGoodsReceipt> {
    this.assertExtraData(dto.extraData, dto.lines);
    return runInOptionalTransaction(
      this.dataSource,
      outerManager,
      async (manager) => {
        const receipt = await this.lockReceipt(manager, entity.id);
        this.voucherEngine.validateVoucherTransition(receipt.status, 'update');

        const receiptRepo = manager.getRepository(GarageGoodsReceipt);
        const lineRepo = manager.getRepository(GarageGoodsReceiptLine);

        const { lines, extraData, ...rawHeader } = dto;
        assertOrderUnchanged(
          receipt.garageProcurementOrderId,
          rawHeader.garageProcurementOrderId,
        );
        // Phiếu đã có đơn: NCC, chi nhánh, tổng tiền do đơn/dòng quyết định, bỏ giá trị client
        let headerDto = receipt.garageProcurementOrderId
          ? stripOrderOwnedFields(rawHeader)
          : rawHeader;
        // Phiếu cũ chưa có đơn được gắn đơn lần đầu: áp NCC, chi nhánh từ đơn
        if (
          !receipt.garageProcurementOrderId &&
          rawHeader.garageProcurementOrderId
        ) {
          const order = await loadOrderForNewReceipt(
            manager,
            rawHeader.garageProcurementOrderId,
          );
          headerDto = {
            ...stripOrderOwnedFields(rawHeader),
            ...receiptFieldsFromOrder(order),
          } as typeof rawHeader;
        }
        const hasOrder = Boolean(
          receipt.garageProcurementOrderId ||
          rawHeader.garageProcurementOrderId,
        );
        const entityFields = toGarageGoodsReceiptEntityFields(headerDto);
        Object.assign(receipt, entityFields);
        if (extraData !== undefined) {
          receipt.extraData = mergeExtraData(receipt.extraData, extraData);
        }

        if (lines !== undefined) {
          // Xóa các lines cũ và chèn lại
          await lineRepo.delete({ garageGoodsReceiptId: receipt.id });

          const lineEntities: GarageGoodsReceiptLine[] = [];
          let lineNo = 1;

          for (const l of lines) {
            const qty = Number(l.qtyReceived || 0);
            const cost = Number(l.unitCost || 0);
            const amount =
              l.amount !== undefined ? Number(l.amount) : qty * cost;

            const line = lineRepo.create({
              garageGoodsReceiptId: receipt.id,
              lineNo: lineNo++,
              itemCode: l.itemCode ?? undefined,
              itemName: l.itemName,
              unit: l.unit || 'Cái',
              qtyReceived: String(qty),
              unitCost: String(cost),
              amount: String(amount),
              notes: l.notes ?? undefined,
              procurementOrderLineId: l.procurementOrderLineId ?? null,
              extraData: l.extraData ?? {},
            });
            lineEntities.push(await lineRepo.save(line));
          }

          if (hasOrder || dto.totalAmount === undefined) {
            receipt.totalAmount = String(
              this.voucherEngine.sumLineAmounts(lineEntities),
            );
          }
          receipt.lines = lineEntities;
        }

        return receiptRepo.save(receipt);
      },
    );
  }

  /** Ghi sổ qua orchestrator: đơn mua, sổ garage_stock_*, thông báo sau commit. */
  async post(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    return this.flow.postReceipt(entity.id);
  }

  /**
   * Lưu nháp (tạo mới khi `id` null, sửa khi có id) rồi ghi sổ nhập kho trong MỘT transaction.
   * Lỗi ghi sổ (vd. lệch đơn mua) rollback cả phiếu vừa lưu, không để nháp mồ côi.
   */
  saveAndPost(
    id: string | null,
    dto: CreateGarageGoodsReceiptDto | UpdateGarageGoodsReceiptDto,
  ): Promise<GarageGoodsReceipt> {
    return this.flow.saveAndPost(async (manager) => {
      const saved = id
        ? await this.update({ id } as GarageGoodsReceipt, dto, manager)
        : await this.create(dto as CreateGarageGoodsReceiptDto, manager);
      return { id: saved.id };
    });
  }

  /** Hủy qua orchestrator: đã post thì hoàn số nhận trên đơn và đảo sổ tồn. */
  async cancel(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    return this.flow.cancelReceipt(entity.id);
  }

  /** Kiểm `extraData` của phiếu và các dòng trước khi mở transaction. */
  private assertExtraData(
    header: Record<string, unknown> | undefined,
    lines: Array<{ extraData?: Record<string, unknown> }> | undefined,
  ): void {
    if (header !== undefined) assertValidExtraData(header);
    lines?.forEach((l) => {
      if (l.extraData !== undefined) assertValidExtraData(l.extraData);
    });
  }

  /** Khóa phiếu để post/cancel không chạy song song trên cùng một phiếu. */
  private async lockReceipt(
    manager: EntityManager,
    id: string,
  ): Promise<GarageGoodsReceipt> {
    const receipt = await manager.findOne(GarageGoodsReceipt, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập kho');
    return receipt;
  }

  async softDelete(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    this.voucherEngine.validateVoucherTransition(entity.status, 'delete');
    entity.isDeleted = true;
    return this.repo.save(entity);
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '../entities/garage-goods-receipt-line.entity';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { UpdateGarageGoodsReceiptDto } from '../dto/update-garage-goods-receipt.dto';
import { toGarageGoodsReceiptEntityFields } from '../helpers/garage-goods-receipt.mapper';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts/services/base-voucher-engine.service';
import { GarageProcurementOrder } from '@/v2/modules/garage-procurement-orders/entities/procurement-order.entity';
import { GarageProcurementOrderFulfilmentService } from '@/v2/modules/garage-procurement-orders/services/procurement-order-fulfilment.service';
import {
  BalanceMove,
  GarageInventoryBalanceService,
} from './garage-inventory-balance.service';

@Injectable()
export class GarageGoodsReceiptCommandService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GarageGoodsReceipt)
    private readonly repo: Repository<GarageGoodsReceipt>,
    private readonly voucherEngine: BaseVoucherEngineService,
    private readonly procurementFulfilment: GarageProcurementOrderFulfilmentService,
    private readonly balances: GarageInventoryBalanceService,
  ) {}

  async generateDailyReceiptNo(orderDate?: string): Promise<string> {
    return this.voucherEngine.generateDailyVoucherNo(
      this.repo,
      'receiptNo',
      'GGR',
      orderDate,
    );
  }

  async create(dto: CreateGarageGoodsReceiptDto): Promise<GarageGoodsReceipt> {
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(GarageGoodsReceipt);
      const lineRepo = manager.getRepository(GarageGoodsReceiptLine);

      const receiptNo =
        dto.receiptNo?.trim() ||
        (await this.generateDailyReceiptNo(dto.receiptDate));

      const { lines = [], ...headerDto } = dto;
      const entityFields = toGarageGoodsReceiptEntityFields({
        ...headerDto,
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
        });
        lineEntities.push(line);
      }

      const calculatedTotal = this.voucherEngine.sumLineAmounts(lineEntities);

      if (dto.totalAmount !== undefined && dto.totalAmount !== null) {
        entityFields.totalAmount = String(dto.totalAmount);
      } else if (lineEntities.length > 0) {
        entityFields.totalAmount = String(calculatedTotal);
      }

      const receipt = receiptRepo.create({
        ...entityFields,
        isDeleted: false,
      });
      const savedReceipt = await receiptRepo.save(receipt);

      for (const line of lineEntities) {
        line.garageGoodsReceiptId = savedReceipt.id;
        await lineRepo.save(line);
      }

      savedReceipt.lines = lineEntities;
      return savedReceipt;
    });
  }

  async update(
    entity: GarageGoodsReceipt,
    dto: UpdateGarageGoodsReceiptDto,
  ): Promise<GarageGoodsReceipt> {
    this.voucherEngine.validateVoucherTransition(entity.status, 'update');

    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(GarageGoodsReceipt);
      const lineRepo = manager.getRepository(GarageGoodsReceiptLine);

      const { lines, ...headerDto } = dto;
      const entityFields = toGarageGoodsReceiptEntityFields(headerDto);
      Object.assign(entity, entityFields);

      if (lines !== undefined) {
        // Xóa các lines cũ và chèn lại
        await lineRepo.delete({ garageGoodsReceiptId: entity.id });

        const lineEntities: GarageGoodsReceiptLine[] = [];
        let lineNo = 1;

        for (const l of lines) {
          const qty = Number(l.qtyReceived || 0);
          const cost = Number(l.unitCost || 0);
          const amount = l.amount !== undefined ? Number(l.amount) : qty * cost;

          const line = lineRepo.create({
            garageGoodsReceiptId: entity.id,
            lineNo: lineNo++,
            itemCode: l.itemCode ?? undefined,
            itemName: l.itemName,
            unit: l.unit || 'Cái',
            qtyReceived: String(qty),
            unitCost: String(cost),
            amount: String(amount),
            notes: l.notes ?? undefined,
            procurementOrderLineId: l.procurementOrderLineId ?? null,
          });
          lineEntities.push(await lineRepo.save(line));
        }

        if (dto.totalAmount === undefined) {
          entity.totalAmount = String(
            this.voucherEngine.sumLineAmounts(lineEntities),
          );
        }
        entity.lines = lineEntities;
      }

      return receiptRepo.save(entity);
    });
  }

  /**
   * Ghi sổ: khóa phiếu, kiểm trạng thái trên bản đã khóa, rồi nhận hàng vào đơn mua và cộng tồn
   * trong cùng transaction. Hai lần post đồng thời cùng phiếu: lần sau đọc trạng thái POSTED và bị chặn.
   */
  async post(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(GarageGoodsReceipt);
      const lineRepo = manager.getRepository(GarageGoodsReceiptLine);

      const receipt = await this.lockReceipt(manager, entity.id);
      this.voucherEngine.validateVoucherTransition(receipt.status, 'post');

      const lines = await lineRepo.find({
        where: { garageGoodsReceiptId: receipt.id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) {
        throw new BadRequestException('Phiếu nhập kho chưa có mặt hàng nào');
      }

      if (receipt.garageProcurementOrderId) {
        await this.assertMatchesOrder(manager, receipt, lines);
        await this.procurementFulfilment.applyGoodsReceipt(
          manager,
          receipt.garageProcurementOrderId,
          this.toFulfilmentItems(lines),
        );
      }

      await this.balances.apply(manager, receipt.branchId, this.toMoves(lines));

      receipt.status = 'POSTED';
      receipt.lines = lines;
      return receiptRepo.save(receipt);
    });
  }

  /** Hủy: nếu đã post thì hoàn số đã nhận trên đơn và trừ tồn, trong cùng transaction có khóa. */
  async cancel(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(GarageGoodsReceipt);
      const lineRepo = manager.getRepository(GarageGoodsReceiptLine);

      const receipt = await this.lockReceipt(manager, entity.id);
      this.voucherEngine.validateVoucherTransition(receipt.status, 'cancel');

      if (receipt.status === 'POSTED') {
        const lines = await lineRepo.find({
          where: { garageGoodsReceiptId: receipt.id },
          order: { lineNo: 'ASC' },
        });

        if (receipt.garageProcurementOrderId) {
          await this.procurementFulfilment.revertGoodsReceipt(
            manager,
            receipt.garageProcurementOrderId,
            this.toFulfilmentItems(lines),
          );
        }
        await this.balances.revert(
          manager,
          receipt.branchId,
          this.toMoves(lines),
        );
      }

      receipt.status = 'CANCELLED';
      return receiptRepo.save(receipt);
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

  private toMoves(lines: GarageGoodsReceiptLine[]): BalanceMove[] {
    return lines.map((line) => ({
      itemCode: line.itemCode || line.itemName,
      itemName: line.itemName,
      unit: line.unit || 'Cái',
      qty: Number(line.qtyReceived || 0),
      cost: Number(line.unitCost || 0),
    }));
  }

  async softDelete(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    this.voucherEngine.validateVoucherTransition(entity.status, 'delete');
    entity.isDeleted = true;
    return this.repo.save(entity);
  }
  /** Dòng phiếu nhập gắn đơn mua phải có dòng đơn mua tương ứng và cùng chi nhánh, NCC với đơn. */
  private async assertMatchesOrder(
    manager: EntityManager,
    receipt: GarageGoodsReceipt,
    lines: GarageGoodsReceiptLine[],
  ): Promise<void> {
    const order = await manager.findOne(GarageProcurementOrder, {
      where: {
        id: receipt.garageProcurementOrderId as string,
        isDeleted: false,
      },
    });
    if (!order) {
      throw new BadRequestException('Không tìm thấy đơn mua garage liên kết');
    }
    if ((receipt.branchId ?? null) !== (order.branchId ?? null)) {
      throw new BadRequestException('Phiếu nhập khác chi nhánh với đơn mua');
    }
    if ((receipt.supplierId ?? null) !== (order.supplierId ?? null)) {
      throw new BadRequestException('Phiếu nhập khác nhà cung cấp với đơn mua');
    }
    this.toFulfilmentItems(lines);
  }

  /** Mỗi dòng phiếu nhập phải trỏ tới một dòng đơn mua. */
  private toFulfilmentItems(lines: GarageGoodsReceiptLine[]) {
    return lines.map((line) => {
      if (!line.procurementOrderLineId) {
        throw new BadRequestException(
          `Dòng ${line.lineNo} chưa gắn dòng đơn mua`,
        );
      }
      return {
        orderLineId: line.procurementOrderLineId,
        qty: Number(line.qtyReceived || 0),
      };
    });
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '../entities/garage-goods-receipt-line.entity';
import { GarageInventoryBalance } from '../entities/garage-inventory-balance.entity';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { UpdateGarageGoodsReceiptDto } from '../dto/update-garage-goods-receipt.dto';
import { toGarageGoodsReceiptEntityFields } from '../helpers/garage-goods-receipt.mapper';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts/services/base-voucher-engine.service';
import { GarageProcurementOrder } from '@/v2/modules/garage-procurement-orders/entities/procurement-order.entity';
import { GarageProcurementOrderFulfilmentService } from '@/v2/modules/garage-procurement-orders/services/procurement-order-fulfilment.service';

@Injectable()
export class GarageGoodsReceiptCommandService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GarageGoodsReceipt)
    private readonly repo: Repository<GarageGoodsReceipt>,
    private readonly voucherEngine: BaseVoucherEngineService,
    private readonly procurementFulfilment: GarageProcurementOrderFulfilmentService,
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

  async post(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    this.voucherEngine.validateVoucherTransition(entity.status, 'post');

    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(GarageGoodsReceipt);
      const balanceRepo = manager.getRepository(GarageInventoryBalance);
      const lineRepo = manager.getRepository(GarageGoodsReceiptLine);

      const lines =
        entity.lines ||
        (await lineRepo.find({
          where: { garageGoodsReceiptId: entity.id },
          order: { lineNo: 'ASC' },
        }));

      if (lines.length === 0) {
        throw new BadRequestException('Phiếu nhập kho chưa có mặt hàng nào');
      }

      if (entity.garageProcurementOrderId) {
        await this.assertMatchesOrder(manager, entity, lines);
        await this.procurementFulfilment.applyGoodsReceipt(
          manager,
          entity.garageProcurementOrderId,
          this.toFulfilmentItems(lines),
        );
      }

      // Update inventory balances for garage
      for (const line of lines) {
        const itemCode = line.itemCode || line.itemName;
        let balance = await balanceRepo.findOne({
          where: {
            branchId: this.balanceBranch(entity.branchId),
            itemCode,
          },
        });

        const qty = Number(line.qtyReceived || 0);
        const cost = Number(line.unitCost || 0);

        if (!balance) {
          balance = balanceRepo.create({
            branchId: entity.branchId ?? null,
            itemCode,
            itemName: line.itemName,
            unit: line.unit || 'Cái',
            qtyOnHand: String(qty),
            avgCost: String(cost),
          });
        } else {
          const currentQty = Number(balance.qtyOnHand || 0);
          const newQty = currentQty + qty;
          balance.qtyOnHand = String(newQty);
          balance.avgCost = String(cost > 0 ? cost : balance.avgCost);
        }
        await balanceRepo.save(balance);
      }

      entity.status = 'POSTED';
      entity.lines = lines;
      return receiptRepo.save(entity);
    });
  }

  async cancel(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    this.voucherEngine.validateVoucherTransition(entity.status, 'cancel');

    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(GarageGoodsReceipt);
      const balanceRepo = manager.getRepository(GarageInventoryBalance);
      const lineRepo = manager.getRepository(GarageGoodsReceiptLine);

      // If already posted, revert stock balances
      if (entity.status === 'POSTED') {
        const lines =
          entity.lines ||
          (await lineRepo.find({
            where: { garageGoodsReceiptId: entity.id },
          }));

        if (entity.garageProcurementOrderId) {
          await this.procurementFulfilment.revertGoodsReceipt(
            manager,
            entity.garageProcurementOrderId,
            this.toFulfilmentItems(lines),
          );
        }

        for (const line of lines) {
          const itemCode = line.itemCode || line.itemName;
          const balance = await balanceRepo.findOne({
            where: {
              branchId: this.balanceBranch(entity.branchId),
              itemCode,
            },
          });

          if (balance) {
            const currentQty = Number(balance.qtyOnHand || 0);
            const qty = Number(line.qtyReceived || 0);
            balance.qtyOnHand = String(Math.max(0, currentQty - qty));
            await balanceRepo.save(balance);
          }
        }
      }

      entity.status = 'CANCELLED';
      return receiptRepo.save(entity);
    });
  }

  async softDelete(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    this.voucherEngine.validateVoucherTransition(entity.status, 'delete');
    entity.isDeleted = true;
    return this.repo.save(entity);
  }
  /** Chi nhánh null phải khớp IS NULL; TypeORM bỏ qua điều kiện undefined nên sẽ khớp nhầm mọi chi nhánh. */
  private balanceBranch(branchId: string | null | undefined) {
    return branchId ? branchId : IsNull();
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

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '../entities/garage-goods-receipt-line.entity';
import { GarageInventoryBalance } from '../entities/garage-inventory-balance.entity';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { UpdateGarageGoodsReceiptDto } from '../dto/update-garage-goods-receipt.dto';
import { toGarageGoodsReceiptEntityFields } from '../helpers/garage-goods-receipt.mapper';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts/services/base-voucher-engine.service';

@Injectable()
export class GarageGoodsReceiptCommandService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GarageGoodsReceipt)
    private readonly repo: Repository<GarageGoodsReceipt>,
    private readonly voucherEngine: BaseVoucherEngineService,
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

      // Update inventory balances for garage
      for (const line of lines) {
        const itemCode = line.itemCode || line.itemName;
        let balance = await balanceRepo.findOne({
          where: {
            branchId: entity.branchId ?? undefined,
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

        for (const line of lines) {
          const itemCode = line.itemCode || line.itemName;
          const balance = await balanceRepo.findOne({
            where: {
              branchId: entity.branchId ?? undefined,
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
}

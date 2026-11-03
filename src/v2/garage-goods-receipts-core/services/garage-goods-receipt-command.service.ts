import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '../entities/garage-goods-receipt-line.entity';
import { GarageInventoryBalance } from '../entities/garage-inventory-balance.entity';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { UpdateGarageGoodsReceiptDto } from '../dto/update-garage-goods-receipt.dto';
import { toGarageGoodsReceiptEntityFields } from '../helpers/garage-goods-receipt.mapper';

@Injectable()
export class GarageGoodsReceiptCommandService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GarageGoodsReceipt)
    private readonly repo: Repository<GarageGoodsReceipt>,
  ) {}

  async generateDailyReceiptNo(orderDate?: string): Promise<string> {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const prefix = `GGR-${year}${month}${day}-`;

    const latest = await this.repo
      .createQueryBuilder('r')
      .where('r.receiptNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('r.receiptNo', 'DESC')
      .getOne();

    const latestSeq = latest?.receiptNo?.slice(prefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
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

      // Calculate total from lines if present
      let calculatedTotal = 0;
      const lineEntities: GarageGoodsReceiptLine[] = [];

      let lineNo = 1;
      for (const l of lines) {
        const qty = Number(l.qtyReceived || 0);
        const cost = Number(l.unitCost || 0);
        const amount = l.amount !== undefined ? Number(l.amount) : qty * cost;
        calculatedTotal += amount;

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
    if (entity.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ có thể chỉnh sửa phiếu ở trạng thái Nháp (DRAFT)',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(GarageGoodsReceipt);
      const lineRepo = manager.getRepository(GarageGoodsReceiptLine);

      const { lines, ...headerDto } = dto;
      Object.assign(entity, toGarageGoodsReceiptEntityFields(headerDto));

      if (lines !== undefined) {
        // Remove existing lines and re-create
        await lineRepo.delete({ garageGoodsReceiptId: entity.id });

        let calculatedTotal = 0;
        const lineEntities: GarageGoodsReceiptLine[] = [];
        let lineNo = 1;
        for (const l of lines) {
          const qty = Number(l.qtyReceived || 0);
          const cost = Number(l.unitCost || 0);
          const amount = l.amount !== undefined ? Number(l.amount) : qty * cost;
          calculatedTotal += amount;

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
          entity.totalAmount = String(calculatedTotal);
        }
        entity.lines = lineEntities;
      }

      return receiptRepo.save(entity);
    });
  }

  async post(entity: GarageGoodsReceipt): Promise<GarageGoodsReceipt> {
    if (entity.status === 'POSTED') {
      throw new BadRequestException(
        'Phiếu nhập kho này đã được ghi sổ trước đó',
      );
    }
    if (entity.status === 'CANCELLED') {
      throw new BadRequestException('Không thể ghi sổ phiếu đã bị hủy');
    }

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

      // Update inventory balances
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
    if (entity.status === 'CANCELLED') {
      throw new BadRequestException('Phiếu nhập kho đã bị hủy trước đó');
    }

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
    if (entity.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ có thể xóa phiếu nhập kho ở trạng thái Nháp (DRAFT)',
      );
    }
    entity.isDeleted = true;
    return this.repo.save(entity);
  }
}

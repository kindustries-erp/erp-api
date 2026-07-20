import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpInventoryAdjustment } from './entities/erp_inventory_adjustment.entity';
import { ErpInventoryAdjustmentLine } from './entities/erp_inventory_adjustment_line.entity';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { UpdateInventoryAdjustmentDto } from './dto/update-inventory-adjustment.dto';
import { PostInventoryAdjustmentDto } from './dto/post-inventory-adjustment.dto';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { Logger } from '@nestjs/common';
import { getGMT7YearMonthDayString } from '../common/utils/date.util';

@Injectable()
export class InventoryAdjustmentsCoreService {
  private readonly logger = new Logger(InventoryAdjustmentsCoreService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpInventoryAdjustment)
    private readonly repository: Repository<ErpInventoryAdjustment>,
    @InjectRepository(ErpInventoryAdjustmentLine)
    private readonly lineRepository: Repository<ErpInventoryAdjustmentLine>,
  ) {}

  private async generateDailyAdjustmentNo(
    manager: any,
    adjustmentDate?: string | Date,
  ) {
    const ymd = getGMT7YearMonthDayString(adjustmentDate);
    const prefix = `DC-${ymd}-`;
    const latest = await manager
      .getRepository(ErpInventoryAdjustment)
      .createQueryBuilder('ia')
      .where('ia.adjustmentNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('LENGTH(ia.adjustmentNo)', 'DESC')
      .addOrderBy('ia.adjustmentNo', 'DESC')
      .getOne();
    const latestSeq = latest?.adjustmentNo?.slice(prefix.length) ?? '00';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(2, '0');
    return `${prefix}${nextSeq}`;
  }

  private async getAdjustmentOrThrow(
    repository: Repository<ErpInventoryAdjustment>,
    id: string,
  ) {
    const adj = await repository.findOneBy({ id, isDeleted: false });
    if (!adj) {
      throw new NotFoundException('Không tìm thấy phiếu điều chỉnh');
    }
    return adj;
  }

  async getNextAdjustmentNo(date?: string): Promise<{ nextNo: string }> {
    const nextNo = await this.dataSource.transaction((manager) =>
      this.generateDailyAdjustmentNo(manager, date),
    );
    return { nextNo };
  }

  async create(dto: CreateInventoryAdjustmentDto) {
    const { lines = [], ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpInventoryAdjustment);
      const lineRepo = manager.getRepository(ErpInventoryAdjustmentLine);
      const adjustmentNo =
        header.adjustmentNo?.trim() ||
        (await this.generateDailyAdjustmentNo(manager, header.adjustmentDate));
      const headerPayload: DeepPartial<ErpInventoryAdjustment> = {
        ...header,
        adjustmentNo,
        status: 'DRAFT',
      };
      const data = await headerRepo.save(headerPayload);
      const savedLines: ErpInventoryAdjustmentLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        const linePayload: DeepPartial<ErpInventoryAdjustmentLine> = {
          adjustmentId: data.id,
          lineNo: lineNo++,
          itemId: line.itemId ?? null,
          qtyAdjusted: line.qtyAdjusted?.toString() ?? '0.000',
          typeAdjust: line.typeAdjust ?? null,
          unitCost: line.unitCost?.toString() ?? null,
        };
        const saved = await lineRepo.save(linePayload);
        savedLines.push(saved);
      }
      return {
        message: 'Tạo phiếu điều chỉnh thành công',
        data: { ...data, lines: savedLines },
      };
    });
  }

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      allowedFields: ['createdAt', 'adjustmentDate', 'adjustmentNo', 'status'],
      columnMap: {
        created_at: 'createdAt',
        adjustment_date: 'adjustmentDate',
      },
      defaultOrder: { createdAt: 'DESC' },
    });
    const where = query.search
      ? ([
          { adjustmentNo: ILike(`%${query.search}%`), isDeleted: false },
        ] as any)
      : ({ isDeleted: false } as any);
    const [items, total] = await this.repository.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.getAdjustmentOrThrow(this.repository, id);
    const lines = await this.lineRepository.find({
      where: { adjustmentId: id },
      order: { lineNo: 'ASC' },
    });
    return {
      message: 'Lấy thông tin thành công',
      data: { ...data, lines },
    };
  }

  async update(id: string, dto: UpdateInventoryAdjustmentDto) {
    const existing = await this.getAdjustmentOrThrow(this.repository, id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ được sửa phiếu điều chỉnh ở trạng thái nháp',
      );
    }
    const { lines, ...header } = dto as any;
    if (header.adjustmentNo === '') {
      delete header.adjustmentNo;
    }
    const updatePayload = { ...header, status: 'DRAFT' };
    await this.repository.update(id, updatePayload);
    if (Array.isArray(lines)) {
      await this.dataSource.transaction(async (manager) => {
        const lineRepo = manager.getRepository(ErpInventoryAdjustmentLine);
        await lineRepo.delete({ adjustmentId: id });
        let lineNo = 1;
        for (const line of lines) {
          const linePayload: DeepPartial<ErpInventoryAdjustmentLine> = {
            adjustmentId: id,
            lineNo: lineNo++,
            itemId: line.itemId ?? null,
            qtyAdjusted: line.qtyAdjusted?.toString() ?? '0.000',
            typeAdjust: line.typeAdjust ?? null,
            unitCost: line.unitCost?.toString() ?? null,
          };
          await lineRepo.save(linePayload);
        }
      });
    }
    return this.findOne(id);
  }

  async postAdjustment(id: string, dto: PostInventoryAdjustmentDto) {
    return this.dataSource.transaction(async (manager) => {
      const adjRepo = manager.getRepository(ErpInventoryAdjustment);
      const lineRepo = manager.getRepository(ErpInventoryAdjustmentLine);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);

      const adj = await this.getAdjustmentOrThrow(adjRepo, id);
      if (adj.status === 'POSTED') {
        throw new BadRequestException(
          'Phiếu điều chỉnh đã được ghi nhận trước đó',
        );
      }

      const lines = await lineRepo.find({
        where: { adjustmentId: id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) {
        throw new BadRequestException('Phiếu điều chỉnh trống');
      }

      for (const line of lines) {
        const qty = Number(line.qtyAdjusted || 0);
        if (qty === 0) continue; // nothing to adjust

        const isIncrease = qty > 0;
        const unitCost = Number(line.unitCost || 0);

        const balanceWhere: any = {
          itemId: line.itemId ?? undefined,
          warehouseCode: dto.warehouseCode ?? undefined,
        };
        let balance = (await balanceRepo.findOne({
          where: balanceWhere,
        })) as ErpInventoryBalance | null;

        const currentQty = Number(balance?.qtyOnHand || 0);
        const currentValue = Number(balance?.inventoryValue || 0);

        const adjValue = qty * unitCost;
        const nextQty = currentQty + qty;
        const nextValue = Math.max(0, currentValue + adjValue);
        const nextAvgUnitCost = nextQty > 0 ? nextValue / nextQty : 0;

        await txnRepo.save(
          txnRepo.create({
            transactionType: 'ADJUSTMENT',
            documentType: 'INVENTORY_ADJUSTMENT',
            documentId: adj.id,
            itemId: line.itemId ?? null,
            warehouseCode: dto.warehouseCode ?? null,
            qtyIn: isIncrease ? qty.toFixed(3) : '0.000',
            qtyOut: !isIncrease ? Math.abs(qty).toFixed(3) : '0.000',
            unitCost: unitCost.toFixed(3),
            transactionDate: adj.adjustmentDate,
            notes: adj.remarks ?? null,
            createdBy: dto.createdBy ?? adj.createdBy ?? null,
          } as any),
        );

        if (!balance) {
          if (!isIncrease) {
            throw new BadRequestException(
              `Không thể giảm số lượng kho cho sản phẩm ở dòng ${line.lineNo} vì chưa có tồn kho.`,
            );
          }
          const balancePayload: DeepPartial<ErpInventoryBalance> = {
            itemId: line.itemId ?? null,
            warehouseCode: dto.warehouseCode ?? null,
            qtyOnHand: nextQty.toFixed(3),
            avgUnitCost: nextAvgUnitCost.toFixed(3),
            inventoryValue: nextValue.toFixed(3),
          };
          balance = await balanceRepo.save(balancePayload);
        } else {
          balance.qtyOnHand = nextQty.toFixed(3);
          balance.avgUnitCost = nextAvgUnitCost.toFixed(3);
          balance.inventoryValue = nextValue.toFixed(3);
          balance = await balanceRepo.save(balance);
        }
      }

      adj.status = 'POSTED';
      const savedAdj = await adjRepo.save(adj);
      const savedLines = await lineRepo.find({
        where: { adjustmentId: id },
        order: { lineNo: 'ASC' },
      });

      return {
        message: 'Vào sổ thành công',
        data: { ...savedAdj, lines: savedLines },
      };
    });
  }

  async cancelAdjustment(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const adjRepo = manager.getRepository(ErpInventoryAdjustment);
      const lineRepo = manager.getRepository(ErpInventoryAdjustmentLine);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);

      const adj = await this.getAdjustmentOrThrow(adjRepo, id);
      if (adj.status === 'CANCELLED') {
        throw new BadRequestException('Phiếu điều chỉnh đã bị hủy trước đó');
      }
      if (adj.status !== 'POSTED') {
        throw new BadRequestException(
          'Chỉ có thể hủy phiếu điều chỉnh đã ghi sổ (POSTED)',
        );
      }

      const lines = await lineRepo.find({
        where: { adjustmentId: id },
        order: { lineNo: 'ASC' },
      });

      for (const line of lines) {
        const qty = Number(line.qtyAdjusted || 0);
        if (qty === 0) continue;

        const isIncrease = qty > 0;
        const unitCost = Number(line.unitCost || 0);

        await txnRepo.save(
          txnRepo.create({
            transactionType: 'ADJUSTMENT_CANCEL',
            documentType: 'INVENTORY_ADJUSTMENT',
            documentId: adj.id,
            itemId: line.itemId ?? null,
            warehouseCode: null, // Depending on if we tracked it, but generally we just revert balance
            qtyIn: !isIncrease ? Math.abs(qty).toFixed(3) : '0.000',
            qtyOut: isIncrease ? qty.toFixed(3) : '0.000',
            unitCost: unitCost.toFixed(3),
            transactionDate: adj.adjustmentDate,
            notes: `Hủy phiếu điều chỉnh ${adj.adjustmentNo}`,
            createdBy: null,
          } as any),
        );

        const balance = await balanceRepo.findOne({
          where: { itemId: line.itemId ?? undefined },
        });
        if (balance) {
          const revertedQty = Math.max(0, Number(balance.qtyOnHand) - qty);
          const revertedValue = Math.max(
            0,
            Number(balance.inventoryValue) - qty * unitCost,
          );
          balance.qtyOnHand = revertedQty.toFixed(3);
          balance.inventoryValue = revertedValue.toFixed(3);
          balance.avgUnitCost =
            revertedQty > 0
              ? (revertedValue / revertedQty).toFixed(3)
              : '0.000';
          await balanceRepo.save(balance);
        }
      }

      adj.status = 'CANCELLED';
      const savedAdj = await adjRepo.save(adj);
      const savedLines = await lineRepo.find({
        where: { adjustmentId: id },
        order: { lineNo: 'ASC' },
      });

      return {
        message: 'Hủy phiếu điều chỉnh thành công',
        data: { ...savedAdj, lines: savedLines },
      };
    });
  }

  async remove(id: string) {
    const existing = await this.repository.findOneBy({ id });
    if (!existing || existing.isDeleted) {
      throw new NotFoundException('Không tìm thấy phiếu điều chỉnh');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ được xóa phiếu điều chỉnh ở trạng thái nháp',
      );
    }
    existing.isDeleted = true;
    const data = await this.repository.save(existing);
    return {
      message: 'Xóa phiếu điều chỉnh thành công',
      data,
    };
  }
}

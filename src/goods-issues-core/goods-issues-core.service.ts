import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpGoodsIssue } from './entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from './entities/erp_goods_issue_line.entity';
import { CreateGoodsIssueDto } from './dto/create-goods-issue.dto';
import { UpdateGoodsIssueDto } from './dto/update-goods-issue.dto';
import { PostGoodsIssueDto } from './dto/post-goods-issue.dto';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpSalesOrder } from '../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../sales-orders-core/entities/erp_sales_order_line.entity';

@Injectable()
export class GoodsIssuesCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpGoodsIssue)
    private readonly repository: Repository<ErpGoodsIssue>,
    @InjectRepository(ErpGoodsIssueLine)
    private readonly lineRepository: Repository<ErpGoodsIssueLine>,
  ) {}

  private async getIssueOrThrow(
    repository: Repository<ErpGoodsIssue>,
    id: string,
  ) {
    const issue = await repository.findOneBy({ id });
    if (!issue) {
      throw new NotFoundException('Không tìm thấy phiếu xuất');
    }
    return issue;
  }

  async create(dto: CreateGoodsIssueDto) {
    const { lines = [], ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpGoodsIssue);
      const lineRepo = manager.getRepository(ErpGoodsIssueLine);
      const headerPayload: DeepPartial<ErpGoodsIssue> = {
        status: header.status ?? 'DRAFT',
        ...header,
      };
      const data = await headerRepo.save(headerPayload);
      const savedLines: ErpGoodsIssueLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        const linePayload: DeepPartial<ErpGoodsIssueLine> = {
          goodsIssueId: data.id,
          lineNo: lineNo++,
          salesOrderLineId: line.salesOrderLineId ?? null,
          itemId: line.itemId ?? null,
          qtyIssued: line.qtyIssued,
          unitCost: line.unitCost ?? null,
          amount: line.amount ?? null,
        };
        const saved = await lineRepo.save(linePayload);
        savedLines.push(saved);
      }
      return {
        message: 'Tạo thành công',
        data: { ...data, lines: savedLines },
      };
    });
  }

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.repository.findAndCount({
      where: query.search
        ? ([{ issueNo: ILike(`%${query.search}%`) }] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
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
    const data = await this.getIssueOrThrow(this.repository, id);
    const lines = await this.lineRepository.find({
      where: { goodsIssueId: id },
      order: { lineNo: 'ASC' },
    });
    return { message: 'Lấy thông tin thành công', data: { ...data, lines } };
  }

  async update(id: string, dto: UpdateGoodsIssueDto) {
    const { lines, ...header } = dto as any;
    await this.repository.update(id, header);
    if (Array.isArray(lines)) {
      await this.dataSource.transaction(async (manager) => {
        const lineRepo = manager.getRepository(ErpGoodsIssueLine);
        await lineRepo.delete({ goodsIssueId: id });
        let lineNo = 1;
        for (const line of lines) {
          const linePayload: DeepPartial<ErpGoodsIssueLine> = {
            goodsIssueId: id,
            lineNo: lineNo++,
            salesOrderLineId: line.salesOrderLineId ?? null,
            itemId: line.itemId ?? null,
            qtyIssued: line.qtyIssued,
            unitCost: line.unitCost ?? null,
            amount: line.amount ?? null,
          };
          await lineRepo.save(linePayload);
        }
      });
    }
    return this.findOne(id);
  }

  async postIssue(id: string, dto: PostGoodsIssueDto) {
    return this.dataSource.transaction(async (manager) => {
      const issueRepo = manager.getRepository(ErpGoodsIssue);
      const lineRepo = manager.getRepository(ErpGoodsIssueLine);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);

      const issue = await this.getIssueOrThrow(issueRepo, id);
      if (issue.status === 'POSTED') {
        throw new BadRequestException('Phiếu xuất đã được ghi nhận trước đó');
      }

      const lines = await lineRepo.find({
        where: { goodsIssueId: id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) {
        throw new BadRequestException('Phiếu xuất chưa có dòng hàng');
      }

      for (const line of lines) {
        const qty = Number(line.qtyIssued || 0);
        if (qty <= 0) {
          throw new BadRequestException(
            `Dòng ${line.lineNo} có số lượng xuất không hợp lệ`,
          );
        }

        const balanceWhere: any = {
          itemId: line.itemId ?? undefined,
          warehouseCode: dto.warehouseCode ?? undefined,
        };
        const balance = await balanceRepo.findOne({ where: balanceWhere });
        const currentQty = Number(balance?.qtyOnHand || 0);
        const currentReserved = Number(balance?.qtyReserved || 0);
        const currentValue = Number(balance?.inventoryValue || 0);
        const avgUnitCost = Number(balance?.avgUnitCost || 0);
        const availableQty = currentQty - currentReserved;
        if (line.salesOrderLineId) {
          if (currentQty < qty) {
            throw new BadRequestException(
              `Tồn kho không đủ cho dòng ${line.lineNo}`,
            );
          }
        } else if (availableQty < qty) {
          throw new BadRequestException(
            `Tồn khả dụng không đủ cho dòng ${line.lineNo}`,
          );
        }

        const issueUnitCost = Number(line.unitCost || avgUnitCost || 0);
        const issueValue = qty * issueUnitCost;
        const nextQty = currentQty - qty;
        const nextValue = Math.max(0, currentValue - issueValue);
        const nextAvgUnitCost = nextQty > 0 ? nextValue / nextQty : 0;

        await txnRepo.save(
          txnRepo.create({
            transactionType: 'ISSUE',
            documentType: 'GOODS_ISSUE',
            documentId: issue.id,
            itemId: line.itemId ?? null,
            warehouseCode: dto.warehouseCode ?? null,
            qtyIn: '0.000',
            qtyOut: qty.toFixed(3),
            unitCost: issueUnitCost.toFixed(3),
            transactionDate: issue.issueDate,
            notes: issue.remarks ?? null,
            createdBy: dto.createdBy ?? issue.createdBy ?? null,
          } as any),
        );

        if (line.salesOrderLineId) {
          const soLine = await soLineRepo.findOneBy({
            id: line.salesOrderLineId,
          });
          if (!soLine) {
            throw new BadRequestException(
              `Không tìm thấy dòng SO tham chiếu cho dòng xuất ${line.lineNo}`,
            );
          }
          const soReserved = Number(soLine.qtyReserved || 0);
          const reservedConsume = Math.min(soReserved, qty);
          soLine.qtyReserved = (soReserved - reservedConsume).toFixed(3);
          const currentDelivered = Number(soLine.qtyDelivered || 0);
          soLine.qtyDelivered = (currentDelivered + qty).toFixed(3);
          await soLineRepo.save(soLine);

          balance!.qtyReserved = Math.max(
            0,
            currentReserved - reservedConsume,
          ).toFixed(3);
        }

        balance!.qtyOnHand = nextQty.toFixed(3);
        balance!.inventoryValue = nextValue.toFixed(3);
        balance!.avgUnitCost = nextAvgUnitCost.toFixed(3);
        await balanceRepo.save(balance!);
      }

      const affectedSalesOrderIds = new Set<string>();
      if (issue.salesOrderId) {
        affectedSalesOrderIds.add(issue.salesOrderId);
      }
      for (const line of lines) {
        if (!line.salesOrderLineId) {
          continue;
        }
        const soLine = await soLineRepo.findOneBy({
          id: line.salesOrderLineId,
        });
        if (soLine?.salesOrderId) {
          affectedSalesOrderIds.add(soLine.salesOrderId);
        }
      }

      for (const salesOrderId of affectedSalesOrderIds) {
        const so = await soRepo.findOneBy({ id: salesOrderId });
        if (!so) {
          continue;
        }
        const refreshedLines = await soLineRepo.find({
          where: { salesOrderId: so.id },
        });
        const allDelivered =
          refreshedLines.length > 0 &&
          refreshedLines.every(
            (line) =>
              Number(line.qtyDelivered || 0) >= Number(line.qtyOrdered || 0),
          );
        const anyDelivered = refreshedLines.some(
          (line) => Number(line.qtyDelivered || 0) > 0,
        );
        const anyReserved = refreshedLines.some(
          (line) => Number(line.qtyReserved || 0) > 0,
        );

        if (allDelivered) {
          so.status = 'DELIVERED';
        } else if (anyReserved) {
          so.status = 'PARTIAL_RESERVED';
        } else if (anyDelivered) {
          so.status = 'PARTIAL_DELIVERED';
        } else {
          so.status = 'CONFIRMED';
        }
        await soRepo.save(so);
      }

      issue.status = 'POSTED';
      await issueRepo.save(issue);
      return this.findOne(id);
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository, In } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpGoodsIssue } from './entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from './entities/erp_goods_issue_line.entity';
import { CreateGoodsIssueDto } from './dto/create-goods-issue.dto';
import { UpdateGoodsIssueDto } from './dto/update-goods-issue.dto';
import { PostGoodsIssueDto } from './dto/post-goods-issue.dto';
import { JournalEntriesService } from '../journal-entries/journal-entries.service';
import { AccountingConfigsCoreService } from '../accounting-configs-core/accounting-configs-core.service';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpSalesOrder } from '../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../sales-orders-core/entities/erp_sales_order_line.entity';
import { ErpInventorySerial } from '../inventory-core/entities/erp_inventory_serial.entity';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';

@Injectable()
export class GoodsIssuesCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpGoodsIssue)
    private readonly repository: Repository<ErpGoodsIssue>,
    @InjectRepository(ErpGoodsIssueLine)
    private readonly lineRepository: Repository<ErpGoodsIssueLine>,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly accountingConfigService: AccountingConfigsCoreService,
  ) {}

  private async getIssueOrThrow(
    repository: Repository<ErpGoodsIssue>,
    id: string,
  ) {
    const issue = await repository.findOneBy({ id, isDeleted: false });
    if (!issue) {
      throw new NotFoundException('Không tìm thấy phiếu xuất');
    }
    return issue;
  }

  private async enrichLines(lines: ErpGoodsIssueLine[], manager?: any) {
    const serialRepo = manager
      ? manager.getRepository(ErpInventorySerial)
      : this.dataSource.getRepository(ErpInventorySerial);
    const vehicleRepo = manager
      ? manager.getRepository(ErpVehicle)
      : this.dataSource.getRepository(ErpVehicle);

    const serialIds = [
      ...new Set(lines.map((line) => line.serialId).filter(Boolean)),
    ] as string[];
    const vehicleIds = [
      ...new Set(lines.map((line) => line.vehicleId).filter(Boolean)),
    ] as string[];

    const [serials, vehicles]: [ErpInventorySerial[], ErpVehicle[]] =
      await Promise.all([
        serialIds.length
          ? serialRepo.findBy(serialIds.map((id) => ({ id })) as any)
          : Promise.resolve([] as ErpInventorySerial[]),
        vehicleIds.length
          ? vehicleRepo.findBy(vehicleIds.map((id) => ({ id })) as any)
          : Promise.resolve([] as ErpVehicle[]),
      ]);

    const serialMap = new Map(
      serials.map((row: ErpInventorySerial) => [row.id, row]),
    );
    const vehicleMap = new Map(
      vehicles.map((row: ErpVehicle) => [row.id, row]),
    );

    return lines.map((line) => {
      const serial = line.serialId ? serialMap.get(line.serialId) : null;
      const vehicle = line.vehicleId ? vehicleMap.get(line.vehicleId) : null;
      return {
        ...line,
        serialNo: serial?.serialNo ?? null,
        vehicleVin: vehicle?.vin ?? null,
        frameNo: vehicle?.frameNo ?? null,
        engineNo: vehicle?.engineNo ?? null,
      };
    });
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
          serialId: line.serialId ?? null,
          vehicleId: line.vehicleId ?? null,
          qtyIssued: line.qtyIssued,
          unitCost: line.unitCost ?? null,
          amount: line.amount ?? null,
        };
        const saved = await lineRepo.save(linePayload);
        savedLines.push(saved);
      }
      return {
        message: 'Tạo thành công',
        data: { ...data, lines: await this.enrichLines(savedLines, manager) },
      };
    });
  }

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      allowedFields: ['createdAt', 'issueDate', 'issueNo', 'status'],
      columnMap: { created_at: 'createdAt', issue_date: 'issueDate' },
      defaultOrder: { createdAt: 'DESC' },
    });
    const where = query.search
      ? ([{ issueNo: ILike(`%${query.search}%`), isDeleted: false }] as any)
      : ({ isDeleted: false } as any);
    const [items, total] = await this.repository.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });
    const customerIds = [
      ...new Set(items.map((i) => i.customerId).filter(Boolean)),
    ] as string[];
    let customerMap = new Map<string, string>();
    if (customerIds.length > 0) {
      const bpRepo = this.dataSource.getRepository(ErpBusinessPartner);
      const customers = await bpRepo.findBy({ id: In(customerIds) });
      customerMap = new Map(customers.map((c) => [c.id, c.name]));
    }

    const enrichedItems = items.map((item) => ({
      ...item,
      customerName: item.customerId
        ? customerMap.get(item.customerId) || null
        : null,
    }));

    return {
      items: enrichedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.getIssueOrThrow(this.repository, id);
    let customerName: string | null = null;
    if (data.customerId) {
      const bpRepo = this.dataSource.getRepository(ErpBusinessPartner);
      const customer = await bpRepo.findOneBy({ id: data.customerId });
      customerName = customer?.name || null;
    }
    const lines = await this.lineRepository.find({
      where: { goodsIssueId: id },
      order: { lineNo: 'ASC' },
    });
    return {
      message: 'Lấy thông tin thành công',
      data: { ...data, customerName, lines: await this.enrichLines(lines) },
    };
  }

  async update(id: string, dto: UpdateGoodsIssueDto) {
    const existing = await this.getIssueOrThrow(this.repository, id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ được sửa phiếu xuất ở trạng thái nháp',
      );
    }
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
            serialId: line.serialId ?? null,
            vehicleId: line.vehicleId ?? null,
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
      const serialRepo = manager.getRepository(ErpInventorySerial);
      const vehicleRepo = manager.getRepository(ErpVehicle);

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

        let serial: ErpInventorySerial | null = null;
        let vehicle: ErpVehicle | null = null;
        if (line.serialId) {
          serial = await serialRepo.findOneBy({ id: line.serialId });
          if (!serial) {
            throw new BadRequestException(
              `Không tìm thấy serial cho dòng ${line.lineNo}`,
            );
          }
          if (serial.itemId && line.itemId && serial.itemId !== line.itemId) {
            throw new BadRequestException(
              `Serial không khớp mặt hàng ở dòng ${line.lineNo}`,
            );
          }
        }
        if (line.vehicleId) {
          vehicle = await vehicleRepo.findOneBy({ id: line.vehicleId });
          if (!vehicle) {
            throw new BadRequestException(
              `Không tìm thấy xe/VIN cho dòng ${line.lineNo}`,
            );
          }
          if (
            vehicle.finishedGoodItemId &&
            line.itemId &&
            vehicle.finishedGoodItemId !== line.itemId
          ) {
            throw new BadRequestException(
              `Xe/VIN không khớp thành phẩm ở dòng ${line.lineNo}`,
            );
          }
        }
        if (serial?.vinId && vehicle?.id && serial.vinId !== vehicle.id) {
          throw new BadRequestException(
            `Serial và xe/VIN không cùng một chiếc ở dòng ${line.lineNo}`,
          );
        }
        if (!vehicle && serial?.vinId) {
          vehicle = await vehicleRepo.findOneBy({ id: serial.vinId });
          line.vehicleId = vehicle?.id ?? line.vehicleId;
        }
        if (!serial && vehicle?.id) {
          serial = await serialRepo.findOneBy({ vinId: vehicle.id });
          line.serialId = serial?.id ?? line.serialId;
        }
        if (serial || vehicle) {
          if (qty !== 1) {
            throw new BadRequestException(
              `Dòng ${line.lineNo} theo serial/xe phải có số lượng = 1`,
            );
          }
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

          if (serial) {
            serial.salesOrderLineId = soLine.id;
          }
        }

        if (serial) {
          serial.goodsIssueLineId = line.id;
          serial.status = 'SOLD';
          if (!serial.vinId && vehicle?.id) {
            serial.vinId = vehicle.id;
          }
          await serialRepo.save(serial);
        }

        if (vehicle) {
          vehicle.status = 'SOLD';
          await vehicleRepo.save(vehicle);
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

      // --- Auto Generate Journal Entry (Chạy ngầm) ---
      const config =
        await this.accountingConfigService.findByModule('goods_issues');
      if (
        config &&
        config.isActive &&
        config.debitAccountId &&
        config.creditAccountId
      ) {
        const totalAmount = lines.reduce(
          (sum, l) => sum + Number(l.qtyIssued || 0) * Number(l.unitCost || 0),
          0,
        );

        try {
          await this.journalEntriesService.create(
            {
              voucher_no: issue.issueNo,
              date: issue.issueDate,
              description: `Hạch toán tự động từ phiếu xuất ${issue.issueNo}`,
              referenceType: 'erp_goods_issues',
              referenceId: issue.id,
              lines: [
                {
                  account_id: config.debitAccountId,
                  debit: totalAmount,
                  credit: 0,
                  description: `Giá vốn từ phiếu xuất ${issue.issueNo}`,
                  sort: 1,
                },
                {
                  account_id: config.creditAccountId,
                  debit: 0,
                  credit: totalAmount,
                  description: `Xuất kho ${issue.issueNo}`,
                  sort: 2,
                },
              ],
            } as any,
            dto.createdBy as string,
          );
        } catch (err) {
          throw new BadRequestException(
            `Không thể sinh bút toán tự động: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`,
          );
        }
      }
      // ------------------------------------------------------

      return this.findOne(id);
    });
  }

  async remove(id: string) {
    const existing = await this.repository.findOneBy({ id });
    if (!existing || existing.isDeleted) {
      throw new NotFoundException('Không tìm thấy phiếu xuất');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ được xóa phiếu xuất ở trạng thái nháp',
      );
    }
    existing.isDeleted = true;
    const data = await this.repository.save(existing);
    return {
      message: 'Xóa phiếu xuất thành công',
      data,
    };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  ILike,
  In,
  Repository,
  Brackets,
} from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpSalesOrder } from './entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from './entities/erp_sales_order_line.entity';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { ReserveSalesOrderDto } from './dto/reserve-sales-order.dto';
import { UnreserveSalesOrderDto } from './dto/unreserve-sales-order.dto';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpSerialLifecycle } from '../inventory-core/entities/erp_serial_lifecycle.entity';
import { ErpGoodsIssue } from '../goods-issues-core/entities/erp_goods_issue.entity';
import { DocumentDependenciesCoreService } from '../document-dependencies-core/document-dependencies-core.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import * as ExcelJS from 'exceljs';
import { format } from 'date-fns';

@Injectable()
export class SalesOrdersCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpSalesOrder)
    private readonly repository: Repository<ErpSalesOrder>,
    @InjectRepository(ErpSalesOrderLine)
    private readonly lineRepository: Repository<ErpSalesOrderLine>,
    private readonly dependencyService: DocumentDependenciesCoreService,
    private readonly companyProfileService: CompanyProfileService,
  ) {}

  private async getSalesOrderOrThrow(
    repository: Repository<ErpSalesOrder>,
    id: string,
  ) {
    const salesOrder = await repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!salesOrder) {
      throw new NotFoundException('Không tìm thấy đơn bán hàng');
    }
    return salesOrder;
  }

  private async generateMonthlySoNo(manager: any, orderDate?: string) {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const year = baseDate.getUTCFullYear();
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const prefix = `SO-${year}${month}-`;
    const latest = await manager
      .getRepository(ErpSalesOrder)
      .createQueryBuilder('so')
      .where('so.soNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('so.soNo', 'DESC')
      .getOne();
    const latestSeq = latest?.soNo?.slice(prefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  private async reserveSerialsForLine(
    manager: any,
    line: any,
    savedLineId: string,
    itemId: string | null,
  ) {
    let reservedQtyForLine = 0;
    if (line.serialIds && line.serialIds.length > 0) {
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const serials = await serialRepo.find({
        where: { id: In(line.serialIds), status: 'IN_STOCK' },
      });
      if (serials.length > 0) {
        reservedQtyForLine = serials.length;
        await serialRepo.update(
          { id: In(serials.map((s: any) => s.id)) },
          { status: 'RESERVED', salesOrderLineId: savedLineId },
        );

        const balances = await balanceRepo.find({
          where: { itemId: itemId ?? undefined } as any,
        });
        let remainingToReserve = reservedQtyForLine;
        for (const b of balances) {
          const available =
            Number(b.qtyOnHand || 0) - Number(b.qtyReserved || 0);
          if (available > 0 && remainingToReserve > 0) {
            const toReserve = Math.min(available, remainingToReserve);
            b.qtyReserved = (Number(b.qtyReserved || 0) + toReserve).toFixed(3);
            await balanceRepo.save(b);
            remainingToReserve -= toReserve;
          }
        }
      }
    }
    return reservedQtyForLine;
  }

  async getNextSoNo(date?: string): Promise<{ nextNo: string }> {
    const nextNo = await this.dataSource.transaction((manager) =>
      this.generateMonthlySoNo(manager, date),
    );
    return { nextNo };
  }

  async create(dto: CreateSalesOrderDto) {
    const { lines = [], ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpSalesOrder);
      const lineRepo = manager.getRepository(ErpSalesOrderLine);
      const soNo =
        header.soNo?.trim() ||
        (await this.generateMonthlySoNo(manager, header.orderDate));
      const headerPayload: DeepPartial<ErpSalesOrder> = {
        status: header.status ?? 'DRAFT',
        ...header,
        soNo,
      };
      const data = await headerRepo.save(headerPayload);
      const savedLines: ErpSalesOrderLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        const linePayload: DeepPartial<ErpSalesOrderLine> = {
          salesOrderId: data.id,
          lineNo: lineNo++,
          itemId: line.itemId ?? null,
          itemName: line.itemName ?? null,
          qtyOrdered: line.qtyOrdered,
          qtyReserved: '0',
          qtyDelivered: '0',
          unitPrice: line.unitPrice ?? null,
          amount: line.amount ?? null,
          selectedSerialIds: line.serialIds ?? null,
        };
        const saved = await lineRepo.save(linePayload);

        const reservedQtyForLine = await this.reserveSerialsForLine(
          manager,
          line as any,
          saved.id,
          saved.itemId,
        );
        if (reservedQtyForLine > 0) {
          saved.qtyReserved = String(reservedQtyForLine);
          await lineRepo.save(saved);
        }

        savedLines.push(saved);
      }

      const anyReserved = savedLines.some(
        (l) => Number(l.qtyReserved || 0) > 0,
      );
      const allReserved =
        savedLines.length > 0 &&
        savedLines.every(
          (l) => Number(l.qtyReserved || 0) >= Number(l.qtyOrdered || 0),
        );
      if (allReserved && data.status !== 'RESERVED') {
        data.status = 'RESERVED';
        await headerRepo.save(data);
      } else if (
        anyReserved &&
        data.status !== 'PARTIAL_RESERVED' &&
        data.status !== 'RESERVED'
      ) {
        data.status = 'PARTIAL_RESERVED';
        await headerRepo.save(data);
      }

      return {
        message: 'Tạo thành công',
        data: { ...data, lines: savedLines },
      };
    });
  }

  async findAll(query: any) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.repository
      .createQueryBuilder('so')
      .leftJoinAndSelect('so.lines', 'lines')
      .leftJoin('erp_business_partners', 'bp', 'so.customer_id = bp.id')
      .where('so.is_deleted = false');

    const notFullyIssued =
      query.notFullyIssued === 'true' || query.notFullyIssued === true;
    const statusFilter = query.status;

    if (notFullyIssued) {
      qb.andWhere('so.status IN (:...statuses)', {
        statuses: ['RESERVED', 'PARTIAL_DELIVERED'],
      });
    } else if (statusFilter) {
      qb.andWhere('so.status = :statusFilter', { statusFilter });
    }

    const tagId = query.tag_id;
    if (tagId) {
      qb.innerJoin(
        'sys_entity_tags',
        'tag',
        "tag.entity_id = so.id AND tag.entity_type = 'erp_sales_order' AND tag.tag_id = :tagId",
        { tagId },
      );
    }

    if (query.search) {
      const keywords = String(query.search)
        .split(';')
        .map((k: string) => k.trim())
        .filter((k: string) => k);
      if (keywords.length > 0) {
        qb.andWhere(
          new Brackets((sqb) => {
            keywords.forEach((kw: string, i: number) => {
              const p = { [`kw${i}`]: `%${kw}%` };
              sqb.orWhere(`so.so_no ILIKE :kw${i}`, p);
              sqb.orWhere(`so.remarks ILIKE :kw${i}`, p);
              sqb.orWhere(`bp.name ILIKE :kw${i}`, p);
              sqb.orWhere(`bp.code ILIKE :kw${i}`, p);
            });
          }),
        );
      }
    }

    if (query.column_filters) {
      try {
        const filters = JSON.parse(query.column_filters);
        for (const [col, vals] of Object.entries(filters)) {
          if (Array.isArray(vals) && vals.length > 0) {
            if (col === 'soNo')
              qb.andWhere('so.so_no IN (:...soNos)', { soNos: vals });
            else if (col === 'status')
              qb.andWhere('so.status IN (:...cStatuses)', { cStatuses: vals });
            else if (col === 'remarks')
              qb.andWhere('so.remarks IN (:...remarks)', { remarks: vals });
            else if (col === 'customerName')
              qb.andWhere('bp.name IN (:...customerNames)', {
                customerNames: vals,
              });
            else if (col === 'orderDate')
              qb.andWhere(
                "TO_CHAR(so.order_date, 'YYYY-MM-DD') IN (:...orderDates)",
                { orderDates: vals },
              );
            else if (col === 'expectedDeliveryDate')
              qb.andWhere(
                "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD') IN (:...expDates)",
                { expDates: vals },
              );
            else if (col === 'totalQty') {
              qb.andWhere(
                (sqb) => {
                  const subQuery = sqb
                    .subQuery()
                    .select('l.sales_order_id')
                    .from('erp_sales_order_lines', 'l')
                    .groupBy('l.sales_order_id')
                    .having('SUM(l.qty_ordered) IN (:...totalQtys)')
                    .getQuery();
                  return `so.id IN ${subQuery}`;
                },
                { totalQtys: vals.map((v) => Number(v)) },
              );
            }
          }
        }
      } catch (e) {}
    }

    if (query.column_search) {
      try {
        const searches = JSON.parse(query.column_search) as Record<
          string,
          string
        >;
        let idx = 0;
        for (const [col, val] of Object.entries(searches)) {
          if (!val) continue;
          const kws = String(val)
            .split(';')
            .map((k) => k.trim())
            .filter((k) => k);
          if (kws.length === 0) continue;

          qb.andWhere(
            new Brackets((sqb) => {
              kws.forEach((kw) => {
                const p = { [`csw${idx}`]: `%${kw}%` };
                if (col === 'soNo') sqb.orWhere(`so.so_no ILIKE :csw${idx}`, p);
                else if (col === 'status')
                  sqb.orWhere(`so.status ILIKE :csw${idx}`, p);
                else if (col === 'remarks')
                  sqb.orWhere(`so.remarks ILIKE :csw${idx}`, p);
                else if (col === 'customerName')
                  sqb.orWhere(
                    `bp.name ILIKE :csw${idx} OR bp.code ILIKE :csw${idx}`,
                    p,
                  );
                else if (col === 'orderDate') {
                  const rawKw = String(kw);
                  if (rawKw.includes('|')) {
                    const [from, to] = rawKw.split('|');
                    if (from && to)
                      sqb.orWhere(
                        `so.order_date >= :from${idx} AND so.order_date <= :to${idx}`,
                        {
                          [`from${idx}`]: from,
                          [`to${idx}`]: to + ' 23:59:59',
                        },
                      );
                    else if (from)
                      sqb.orWhere(`so.order_date >= :from${idx}`, {
                        [`from${idx}`]: from,
                      });
                    else if (to)
                      sqb.orWhere(`so.order_date <= :to${idx}`, {
                        [`to${idx}`]: to + ' 23:59:59',
                      });
                  } else {
                    sqb.orWhere(
                      "TO_CHAR(so.order_date, 'YYYY-MM-DD') ILIKE :csw${idx}",
                      p,
                    );
                  }
                } else if (col === 'expectedDeliveryDate') {
                  const rawKw = String(kw);
                  if (rawKw.includes('|')) {
                    const [from, to] = rawKw.split('|');
                    if (from && to)
                      sqb.orWhere(
                        `so.expected_delivery_date >= :from${idx} AND so.expected_delivery_date <= :to${idx}`,
                        {
                          [`from${idx}`]: from,
                          [`to${idx}`]: to + ' 23:59:59',
                        },
                      );
                    else if (from)
                      sqb.orWhere(`so.expected_delivery_date >= :from${idx}`, {
                        [`from${idx}`]: from,
                      });
                    else if (to)
                      sqb.orWhere(`so.expected_delivery_date <= :to${idx}`, {
                        [`to${idx}`]: to + ' 23:59:59',
                      });
                  } else {
                    sqb.orWhere(
                      "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD') ILIKE :csw${idx}",
                      p,
                    );
                  }
                } else if (col === 'deliveredDate') {
                  const rawKw = String(kw);
                  if (rawKw.includes('|')) {
                    const [from, to] = rawKw.split('|');
                    if (from && to)
                      sqb.orWhere(
                        `EXISTS (SELECT 1 FROM erp_serial_lifecycles l2 WHERE l2.sales_order_id = so.id AND l2.delivery_date >= :from${idx} AND l2.delivery_date <= :to${idx})`,
                        {
                          [`from${idx}`]: from,
                          [`to${idx}`]: to + ' 23:59:59',
                        },
                      );
                    else if (from)
                      sqb.orWhere(
                        `EXISTS (SELECT 1 FROM erp_serial_lifecycles l2 WHERE l2.sales_order_id = so.id AND l2.delivery_date >= :from${idx})`,
                        { [`from${idx}`]: from },
                      );
                    else if (to)
                      sqb.orWhere(
                        `EXISTS (SELECT 1 FROM erp_serial_lifecycles l2 WHERE l2.sales_order_id = so.id AND l2.delivery_date <= :to${idx})`,
                        { [`to${idx}`]: to + ' 23:59:59' },
                      );
                  } else {
                    sqb.orWhere(
                      `EXISTS (SELECT 1 FROM erp_serial_lifecycles l2 WHERE l2.sales_order_id = so.id AND TO_CHAR(l2.delivery_date, 'YYYY-MM-DD') ILIKE :csw${idx})`,
                      p,
                    );
                  }
                }
                idx++;
              });
            }),
          );
        }
      } catch (e) {}
    }

    if (query.sortField && query.sortOrder) {
      const dir = query.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      if (query.sortField === 'soNo') qb.orderBy('so.so_no', dir);
      else if (query.sortField === 'orderDate')
        qb.orderBy('so.order_date', dir);
      else if (query.sortField === 'expectedDeliveryDate')
        qb.orderBy('so.expected_delivery_date', dir);
      else if (query.sortField === 'status') qb.orderBy('so.status', dir);
      else if (query.sortField === 'remarks') qb.orderBy('so.remarks', dir);
      else if (query.sortField === 'customerName') qb.orderBy('bp.name', dir);
    } else {
      const order = resolveSortOrder(query.sort, {
        defaultOrder: { createdAt: 'DESC' },
      });
      Object.entries(order).forEach(([key, val]) => {
        qb.addOrderBy(`so.${key}`, val as any);
      });
    }

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return this.enrichDeliveryDates(
      await this.enrichCustomerNames({
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }),
    );
  }

  private async enrichCustomerNames(result: any) {
    if (result.items.length > 0) {
      const customerIds = [
        ...new Set(result.items.map((i: any) => i.customerId).filter(Boolean)),
      ];
      if (customerIds.length > 0) {
        const partners = await this.dataSource.query(
          `SELECT id, name FROM erp_business_partners WHERE id = ANY($1)`,
          [customerIds],
        );
        const partnerMap = new Map(partners.map((p: any) => [p.id, p.name]));
        for (const item of result.items) {
          if (item.customerId) {
            item.customerName = partnerMap.get(item.customerId);
          }
        }
      }
    }
    return result;
  }

  private async enrichDeliveryDates(result: any) {
    if (result.items.length > 0) {
      const soIds = result.items.map((i: any) => i.id);
      const lifecycleDates = await this.dataSource.query(
        `SELECT sales_order_id, MAX(delivery_date) as max_date
         FROM erp_serial_lifecycles
         WHERE sales_order_id = ANY($1)
         GROUP BY sales_order_id`,
        [soIds],
      );
      const lifecycleMap = new Map(
        lifecycleDates.map((r: any) => [r.sales_order_id, r.max_date]),
      );
      for (const item of result.items) {
        const d = lifecycleMap.get(item.id);
        if (d) {
          item.deliveredDate = d;
        }
      }
    }
    return result;
  }

  async findOne(id: string) {
    const data = await this.getSalesOrderOrThrow(this.repository, id);
    const lines = await this.lineRepository.find({
      where: { salesOrderId: id },
      order: { lineNo: 'ASC' },
    });

    // Inject serialIds
    const serialRepo = this.dataSource.getRepository(
      ErpInventoryTrackingSerial,
    );
    const serials = await serialRepo.find({
      where: { salesOrderLineId: In(lines.map((l) => l.id)) },
    });
    const serialsByLine = serials.reduce(
      (acc, s) => {
        if (!acc[s.salesOrderLineId!]) acc[s.salesOrderLineId!] = [];
        acc[s.salesOrderLineId!].push(s.id);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    const itemIds = [
      ...new Set(lines.map((l) => l.itemId).filter(Boolean)),
    ] as string[];
    const itemsMap: Record<string, string> = {};
    if (itemIds.length > 0) {
      const itemRepo = this.dataSource.getRepository(ErpInventoryItem);
      const items = await itemRepo.find({ where: { id: In(itemIds) } });
      for (const it of items) {
        itemsMap[it.id] = it.itemName;
      }
    }

    const linesWithSerials = lines.map((l) => ({
      ...l,
      serialIds: serialsByLine[l.id] || [],
      itemName: l.itemName || (l.itemId ? itemsMap[l.itemId] : null),
    }));

    const goodsIssueRepo = this.dataSource.getRepository(ErpGoodsIssue);
    const goodsIssues = await goodsIssueRepo.find({
      where: { salesOrderId: id } as any,
      order: { createdAt: 'DESC' },
    });

    const serialLifecycles = await this.dataSource.query(
      `
      SELECT 
        l.id,
        l.serial_id as "serialId",
        l.sales_order_id as "salesOrderId",
        l.goods_issue_id as "goodsIssueId",
        l.delivery_date as "deliveryDate",
        s.serial_no as "serialNo", 
        v.vin_no as "vinNo", 
        v.engine_no as "engineNo"
      FROM erp_serial_lifecycles l
      LEFT JOIN erp_inventory_tracking_serials s ON s.id = l.serial_id
      LEFT JOIN erp_vehicles v ON v.id = s.vin_id
      WHERE l.sales_order_id = $1
    `,
      [id],
    );

    return {
      message: 'Lấy thông tin thành công',
      data: { ...data, lines: linesWithSerials, goodsIssues, serialLifecycles },
    };
  }

  private async releaseSerialsAndBalances(manager: any, salesOrderId: string) {
    const lineRepo = manager.getRepository(ErpSalesOrderLine);
    const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
    const balanceRepo = manager.getRepository(ErpInventoryBalance);

    const lines = await lineRepo.find({ where: { salesOrderId } });
    if (lines.length === 0) return;

    for (const line of lines) {
      const qtyReserved = Number(line.qtyReserved || 0);
      if (qtyReserved > 0) {
        const balances = await balanceRepo.find({
          where: { itemId: line.itemId ?? undefined } as any,
        });
        let remainingToUnreserve = qtyReserved;
        for (const balance of balances) {
          if (remainingToUnreserve <= 0) break;
          const balanceReserved = Number(balance.qtyReserved || 0);
          if (balanceReserved > 0) {
            const qtyToRelease = Math.min(
              balanceReserved,
              remainingToUnreserve,
            );
            balance.qtyReserved = Math.max(
              0,
              balanceReserved - qtyToRelease,
            ).toFixed(3);
            await balanceRepo.save(balance);
            remainingToUnreserve -= qtyToRelease;
          }
        }
      }
    }

    await serialRepo.update(
      { salesOrderLineId: In(lines.map((l) => l.id)), status: 'RESERVED' },
      { status: 'IN_STOCK', salesOrderLineId: null },
    );
  }

  async update(id: string, dto: UpdateSalesOrderDto) {
    const { lines, ...header } = dto as any;

    if (header.status === 'CANCELLED') {
      const existing = await this.repository.findOneBy({ id });
      if (existing && existing.status !== 'CANCELLED') {
        await this.dependencyService.checkDependencies(
          'sales_service_orders',
          id,
        );
      }
    }

    await this.repository.update(id, header);
    if (Array.isArray(lines)) {
      await this.dataSource.transaction(async (manager) => {
        await this.releaseSerialsAndBalances(manager, id);
        const lineRepo = manager.getRepository(ErpSalesOrderLine);
        await lineRepo.delete({ salesOrderId: id });
        let lineNo = 1;
        const savedLines: ErpSalesOrderLine[] = [];
        for (const line of lines) {
          const linePayload: DeepPartial<ErpSalesOrderLine> = {
            salesOrderId: id,
            lineNo: lineNo++,
            itemId: line.itemId ?? null,
            itemName: line.itemName ?? null,
            qtyOrdered: line.qtyOrdered,
            qtyReserved: line.qtyReserved ?? '0',
            qtyDelivered: line.qtyDelivered ?? '0',
            unitPrice: line.unitPrice ?? null,
            amount: line.amount ?? null,
            selectedSerialIds: line.serialIds ?? null,
          };
          const saved = await lineRepo.save(linePayload);

          const reservedQtyForLine = await this.reserveSerialsForLine(
            manager,
            line as any,
            saved.id,
            saved.itemId,
          );
          if (reservedQtyForLine > 0) {
            saved.qtyReserved = String(reservedQtyForLine);
            await lineRepo.save(saved);
          }
          savedLines.push(saved);
        }

        const so = await manager.getRepository(ErpSalesOrder).findOneBy({ id });
        if (so && so.status !== 'CANCELLED') {
          const anyReserved = savedLines.some(
            (l) => Number(l.qtyReserved || 0) > 0,
          );
          const allReserved =
            savedLines.length > 0 &&
            savedLines.every(
              (l) => Number(l.qtyReserved || 0) >= Number(l.qtyOrdered || 0),
            );
          if (allReserved && so.status !== 'RESERVED') {
            so.status = 'RESERVED';
            await manager.getRepository(ErpSalesOrder).save(so);
          } else if (
            anyReserved &&
            so.status !== 'PARTIAL_RESERVED' &&
            so.status !== 'RESERVED'
          ) {
            so.status = 'PARTIAL_RESERVED';
            await manager.getRepository(ErpSalesOrder).save(so);
          }
        }
      });
    }
    return this.findOne(id);
  }

  async reserve(id: string, dto: ReserveSalesOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);

      const so = await this.getSalesOrderOrThrow(soRepo, id);
      const lines = await soLineRepo.find({
        where: { salesOrderId: id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) {
        throw new BadRequestException('Sales order chưa có dòng hàng');
      }

      for (const line of lines) {
        const qtyOrdered = Number(line.qtyOrdered || 0);
        const qtyDelivered = Number(line.qtyDelivered || 0);
        const qtyReserved = Number(line.qtyReserved || 0);
        const qtyNeedReserve = qtyOrdered - qtyDelivered - qtyReserved;
        if (qtyNeedReserve <= 0) {
          continue;
        }

        const balance = await balanceRepo.findOne({
          where: {
            itemId: line.itemId ?? undefined,
            warehouseCode: dto.warehouseCode ?? undefined,
          } as any,
        });
        if (!balance) {
          continue;
        }
        const onHand = Number(balance.qtyOnHand || 0);
        const reserved = Number(balance.qtyReserved || 0);
        const available = onHand - reserved;
        let qtyToReserve = Math.min(available, qtyNeedReserve);
        if (qtyToReserve <= 0) {
          continue;
        }

        const item = line.itemId
          ? await manager
              .getRepository(ErpInventoryItem)
              .findOne({ where: { id: line.itemId } as any })
          : null;
        if (
          item?.trackingPolicyId &&
          item.trackingPolicyId !== 'NONE' &&
          line.itemId
        ) {
          if (!line.selectedSerialIds || line.selectedSerialIds.length === 0) {
            continue;
          }
          const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
          const availableSerials = await serialRepo.find({
            where: { id: In(line.selectedSerialIds), status: 'IN_STOCK' },
          });

          if (availableSerials.length === 0) {
            continue;
          }

          qtyToReserve = Math.min(qtyToReserve, availableSerials.length);
          const serialsToReserve = availableSerials.slice(0, qtyToReserve);

          await serialRepo.update(
            { id: In(serialsToReserve.map((s) => s.id)) },
            { status: 'RESERVED', salesOrderLineId: line.id },
          );
        }

        balance.qtyReserved = (reserved + qtyToReserve).toFixed(3);
        await balanceRepo.save(balance);

        line.qtyReserved = (qtyReserved + qtyToReserve).toFixed(3);
        await soLineRepo.save(line);
      }

      const refreshedLines = await soLineRepo.find({
        where: { salesOrderId: id },
      });
      const allReserved =
        refreshedLines.length > 0 &&
        refreshedLines.every(
          (line) =>
            Number(line.qtyReserved || 0) + Number(line.qtyDelivered || 0) >=
            Number(line.qtyOrdered || 0),
        );
      const anyReserved = refreshedLines.some(
        (line) => Number(line.qtyReserved || 0) > 0,
      );
      so.status = allReserved
        ? 'RESERVED'
        : anyReserved
          ? 'PARTIAL_RESERVED'
          : so.status;
      await soRepo.save(so);

      return this.findOne(id);
    });
  }

  async unreserve(id: string, dto: UnreserveSalesOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);

      const so = await this.getSalesOrderOrThrow(soRepo, id);
      const lines = await soLineRepo.find({
        where: { salesOrderId: id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) {
        throw new BadRequestException('Sales order chưa có dòng hàng');
      }

      for (const line of lines) {
        const qtyReserved = Number(line.qtyReserved || 0);
        if (qtyReserved <= 0) {
          continue;
        }

        const balance = await balanceRepo.findOne({
          where: {
            itemId: line.itemId ?? undefined,
            warehouseCode: dto.warehouseCode ?? undefined,
          } as any,
        });
        if (!balance) {
          continue;
        }

        const balanceReserved = Number(balance.qtyReserved || 0);
        const qtyToRelease = Math.min(balanceReserved, qtyReserved);
        balance.qtyReserved = Math.max(
          0,
          balanceReserved - qtyToRelease,
        ).toFixed(3);
        await balanceRepo.save(balance);

        line.qtyReserved = Math.max(0, qtyReserved - qtyToRelease).toFixed(3);
        await soLineRepo.save(line);
      }

      // Release serials
      if (lines.length > 0) {
        const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
        await serialRepo.update(
          { salesOrderLineId: In(lines.map((l) => l.id)), status: 'RESERVED' },
          { status: 'IN_STOCK', salesOrderLineId: null },
        );
      }

      const refreshedLines = await soLineRepo.find({
        where: { salesOrderId: id },
      });
      const anyReserved = refreshedLines.some(
        (line) => Number(line.qtyReserved || 0) > 0,
      );
      const allDelivered =
        refreshedLines.length > 0 &&
        refreshedLines.every(
          (line) =>
            Number(line.qtyDelivered || 0) >= Number(line.qtyOrdered || 0),
        );
      const anyDelivered = refreshedLines.some(
        (line) => Number(line.qtyDelivered || 0) > 0,
      );

      if (allDelivered) {
        so.status = 'DELIVERING';
      } else if (anyReserved) {
        so.status = 'PARTIAL_RESERVED';
      } else if (anyDelivered) {
        so.status = 'PARTIAL_DELIVERING';
      } else {
        so.status = 'CONFIRMED';
      }
      await soRepo.save(so);

      return this.findOne(id);
    });
  }

  async confirmAllDelivery(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const so = await this.getSalesOrderOrThrow(soRepo, id);

      if (so.status !== 'DELIVERING' && so.status !== 'PARTIAL_DELIVERING') {
        throw new BadRequestException(
          'Chỉ có thể xác nhận giao hàng khi đơn hàng đang ở trạng thái đang giao',
        );
      }

      // Check if there are any DELIVERING serials to prevent bypassing tracking
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
      const lines = await soLineRepo.find({ where: { salesOrderId: so.id } });
      if (lines.length > 0) {
        const anyDeliveringSerial = await serialRepo.findOne({
          where: {
            salesOrderLineId: In(lines.map((l) => l.id)),
            status: 'DELIVERING',
          },
        });
        if (anyDeliveringSerial) {
          throw new BadRequestException(
            'Đơn hàng có thiết bị tracking đang giao, vui lòng xác nhận giao từng serial/xe cụ thể',
          );
        }
      }

      so.status = 'DELIVERED';
      await soRepo.save(so);

      return this.findOne(id);
    });
  }

  async remove(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const existing = await soRepo.findOne({
        where: { id, isDeleted: false },
      });
      if (!existing)
        throw new NotFoundException(`Đơn bán hàng ${id} không tìm thấy`);
      if (existing.status !== 'DRAFT') {
        throw new BadRequestException('Chỉ có thể xóa đơn bán hàng nháp');
      }

      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const lines = await soLineRepo.find({ where: { salesOrderId: id } });
      if (lines.length > 0) {
        const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
        await serialRepo.update(
          { salesOrderLineId: In(lines.map((l) => l.id)), status: 'RESERVED' },
          { status: 'IN_STOCK', salesOrderLineId: null },
        );
      }

      await soRepo.update(id, { isDeleted: true } as any);
      return { message: 'Xóa thành công' };
    });
  }

  async cancel(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);

      const existing = await soRepo.findOne({
        where: { id, isDeleted: false },
      });
      if (!existing)
        throw new NotFoundException(`Đơn bán hàng ${id} không tìm thấy`);
      if (existing.status === 'CANCELLED') {
        throw new BadRequestException('Đơn bán hàng đã bị hủy');
      }
      if (existing.status === 'DRAFT') {
        throw new BadRequestException('Không thể hủy đơn nháp, vui lòng xóa');
      }

      // Call dependencies check just in case
      await this.dependencyService.checkDependencies(
        'sales_service_orders',
        id,
      );

      // Unreserve logic
      const lines = await soLineRepo.find({ where: { salesOrderId: id } });
      for (const line of lines) {
        const qtyReserved = Number(line.qtyReserved || 0);
        if (qtyReserved > 0) {
          const balances = await balanceRepo.find({
            where: { itemId: line.itemId ?? undefined } as any,
          });
          let remainingToUnreserve = qtyReserved;
          for (const balance of balances) {
            if (remainingToUnreserve <= 0) break;
            const balanceReserved = Number(balance.qtyReserved || 0);
            if (balanceReserved > 0) {
              const qtyToRelease = Math.min(
                balanceReserved,
                remainingToUnreserve,
              );
              balance.qtyReserved = Math.max(
                0,
                balanceReserved - qtyToRelease,
              ).toFixed(3);
              await balanceRepo.save(balance);
              remainingToUnreserve -= qtyToRelease;
            }
          }
          line.qtyReserved = '0';
          await soLineRepo.save(line);
        }
      }

      // Release serials
      if (lines.length > 0) {
        const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
        await serialRepo.update(
          { salesOrderLineId: In(lines.map((l) => l.id)), status: 'RESERVED' },
          { status: 'IN_STOCK', salesOrderLineId: null },
        );
      }

      existing.status = 'CANCELLED';
      await soRepo.save(existing);

      return {
        message: 'Hủy thành công',
        data: { id },
      };
    });
  }

  async exportXlsx(id: string): Promise<Buffer> {
    const orderRes = await this.findOne(id);
    const order = orderRes.data;

    const companyProfile = await this.companyProfileService.getProfile();

    let customerName = (order as any).customerName || '';
    let customerTaxCode = '';
    let customerAddress = '';
    if (order.customerId) {
      const customer = await this.dataSource
        .getRepository(ErpBusinessPartner)
        .findOne({
          where: { id: order.customerId },
        });
      if (customer) {
        const namePart = customer.displayName || customer.name;
        customerName = `${customer.code} - ${namePart}`;
        customerTaxCode = customer.taxCode || '';
        customerAddress = customer.address || '';
      }
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('DonBanHang');

    const defaultFont = { name: 'Times New Roman', size: 11 };

    // Header setup
    sheet.getColumn('A').width = 5; // STT
    sheet.getColumn('B').width = 25; // Ten hang
    sheet.getColumn('C').width = 20; // So khung
    sheet.getColumn('D').width = 20; // So may
    sheet.getColumn('E').width = 15; // So serial
    sheet.getColumn('F').width = 10; // Mau xe
    sheet.getColumn('G').width = 10; // So luong
    sheet.getColumn('H').width = 15; // Don gia
    sheet.getColumn('I').width = 15; // Thanh tien

    // Row 1: Company
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = (
      companyProfile?.company_name || 'Đơn vị: ............................'
    ).toUpperCase();
    sheet.getCell('A1').font = { ...defaultFont, bold: true };
    sheet.getCell('A1').alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    };
    sheet.getRow(1).height = 25;

    // Row 2: Address
    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value =
      companyProfile?.address || 'Địa chỉ: ............................';
    sheet.getCell('A2').font = defaultFont;
    sheet.getCell('A2').alignment = {
      vertical: 'top',
      horizontal: 'left',
      wrapText: true,
    };
    sheet.getRow(2).height = 35;

    // Row 4: Title
    sheet.mergeCells('A4:I4');
    sheet.getCell('A4').value = 'ĐƠN BÁN HÀNG';
    sheet.getCell('A4').font = { ...defaultFont, bold: true, size: 16 };
    sheet.getCell('A4').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    // Row 5: Date
    const orderDate = order.orderDate ? new Date(order.orderDate) : new Date();
    sheet.mergeCells('A5:I5');
    sheet.getCell('A5').value = `Ngày ${format(
      orderDate,
      'dd',
    )} tháng ${format(orderDate, 'MM')} năm ${format(orderDate, 'yyyy')}`;
    sheet.getCell('A5').font = { ...defaultFont, italic: true };
    sheet.getCell('A5').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    sheet.addRow([]);

    const infoRow1 = sheet.addRow([`- Số đơn hàng: ${order.soNo || ''}`]);
    sheet.mergeCells(`A${infoRow1.number}:I${infoRow1.number}`);

    const infoRow2 = sheet.addRow([`- Khách hàng: ${customerName || ''}`]);
    sheet.mergeCells(`A${infoRow2.number}:I${infoRow2.number}`);

    const taxRow = sheet.addRow([`- Mã số thuế: ${customerTaxCode || ''}`]);
    sheet.mergeCells(`A${taxRow.number}:I${taxRow.number}`);

    const addrRow = sheet.addRow([`- Địa chỉ: ${customerAddress || ''}`]);
    sheet.mergeCells(`A${addrRow.number}:I${addrRow.number}`);

    const statusMap: Record<string, string> = {
      DRAFT: 'Nháp',
      CONFIRMED: 'Đã xác nhận',
      IN_PROGRESS: 'Đang xử lý',
      DELIVERED: 'Đã giao hàng',
      CANCELLED: 'Đã hủy',
    };
    const translatedStatus = statusMap[order.status] || order.status;
    const infoRow3 = sheet.addRow([`- Trạng thái: ${translatedStatus || ''}`]);
    sheet.mergeCells(`A${infoRow3.number}:I${infoRow3.number}`);

    const infoRow4 = sheet.addRow([`- Ghi chú: ${order.remarks || ''}`]);
    sheet.mergeCells(`A${infoRow4.number}:I${infoRow4.number}`);

    sheet.addRow([]);

    // Table Headers
    const headerRow = sheet.addRow([
      'STT',
      'Tên hàng',
      'Số khung',
      'Số máy',
      'Số serial',
      'Màu xe',
      'Số lượng',
      'Đơn giá',
      'Thành tiền',
    ]);
    headerRow.eachCell((cell) => {
      cell.font = { ...defaultFont, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    let index = 1;
    let totalAmount = 0;

    const serialRepo = this.dataSource.getRepository(
      ErpInventoryTrackingSerial,
    );
    const vehicleRepo = this.dataSource.getRepository(ErpVehicle);

    if (order.lines && order.lines.length > 0) {
      for (const line of order.lines) {
        let serials: ErpInventoryTrackingSerial[] = [];
        if (line.selectedSerialIds && line.selectedSerialIds.length > 0) {
          serials = await serialRepo.find({
            where: { id: In(line.selectedSerialIds) },
          });
        } else if (order.status !== 'DRAFT') {
          serials = await serialRepo.find({
            where: { salesOrderLineId: line.id },
          });
        }

        const qty = Number(line.qtyOrdered) || 0;
        const price = Number(line.unitPrice) || 0;
        const amount = Number(line.amount) || qty * price;
        totalAmount += amount;

        if (serials.length > 0) {
          // Pre-fetch vehicles
          const vinIds = serials
            .map((s) => s.vinId)
            .filter((id): id is string => Boolean(id));
          const vehicles =
            vinIds.length > 0
              ? await vehicleRepo.find({ where: { id: In(vinIds) } })
              : [];
          const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

          for (let i = 0; i < serials.length; i++) {
            const serial = serials[i];
            const attrs = serial.attributes || {};
            const vehicle = serial.vinId ? vehicleMap.get(serial.vinId) : null;
            const isFirst = i === 0;

            const chassisNo =
              vehicle?.vinNo || attrs.chassisNo || attrs['Số khung'] || '';
            const engineNo =
              vehicle?.engineNo || attrs.engineNo || attrs['Số máy'] || '';

            const row = sheet.addRow([
              index++,
              line.itemName || '',
              chassisNo,
              engineNo,
              serial.serialNo || '',
              attrs.color || attrs['Màu xe'] || '',
              1, // each serial is 1 unit
              price,
              price, // each row is price * 1
            ]);
            row.eachCell((cell) => {
              cell.font = defaultFont;
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
              };
            });
            // format number
            row.getCell('G').numFmt = '#,##0.00';
            row.getCell('H').numFmt = '#,##0.00';
            row.getCell('I').numFmt = '#,##0.00';
          }
        } else {
          const row = sheet.addRow([
            index++,
            line.itemName || '',
            '',
            '',
            '',
            '',
            qty,
            price,
            amount,
          ]);
          row.eachCell((cell) => {
            cell.font = defaultFont;
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          });
          row.getCell('G').numFmt = '#,##0.00';
          row.getCell('H').numFmt = '#,##0.00';
          row.getCell('I').numFmt = '#,##0.00';
        }
      }
    }

    const totalRow = sheet.addRow([
      '',
      'Tổng cộng',
      '',
      '',
      '',
      '',
      '',
      '',
      totalAmount,
    ]);
    sheet.mergeCells(`B${totalRow.number}:H${totalRow.number}`);
    totalRow.eachCell((cell) => {
      cell.font = { ...defaultFont, bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    totalRow.getCell('I').numFmt = '#,##0.00';
    totalRow.getCell('B').alignment = { horizontal: 'right' };

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any as Buffer;
  }

  async getSalesOrdersColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    let selectField = '';
    let isDateColumn = false;
    let isTotalQty = column === 'totalQty';

    if (column === 'orderDate' || column === 'expectedDeliveryDate') {
      selectField =
        column === 'orderDate'
          ? "TO_CHAR(so.order_date, 'YYYY-MM-DD')"
          : "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'soNo') selectField = 'so.so_no';
    else if (column === 'customerName') selectField = 'bp.name';
    else if (column === 'status') selectField = 'so.status';
    else if (column === 'remarks') selectField = 'so.remarks';
    else if (column === 'totalQty') selectField = 'totalQty';
    else {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let params: any[] = [];
    let paramIdx = 1;
    let filterConditions = '';

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          let filterField = '';
          if (col === 'orderDate')
            filterField = "TO_CHAR(so.order_date, 'YYYY-MM-DD')";
          else if (col === 'expectedDeliveryDate')
            filterField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
          else if (col === 'soNo') filterField = 'so.so_no';
          else if (col === 'customerName') filterField = 'bp.name';
          else if (col === 'status') filterField = 'so.status';
          else if (col === 'remarks') filterField = 'so.remarks';
          else if (col === 'totalQty') {
            const placeholders = vals
              .map((v) => Number(v))
              .map(() => `$${paramIdx++}`)
              .join(', ');
            // We use a subquery to filter by totalQty
            filterConditions += ` AND so.id IN (SELECT sales_order_id FROM erp_sales_order_lines GROUP BY sales_order_id HAVING SUM(qty_ordered) IN (${placeholders}))`;
            params.push(...vals.map((v) => Number(v)));
            continue;
          }

          if (filterField) {
            const placeholders = vals.map(() => `$${paramIdx++}`).join(', ');
            filterConditions += ` AND CAST(${filterField} AS TEXT) IN (${placeholders})`;
            params.push(...vals);
          }
        }
      } catch (e) {}
    }

    let sql = '';
    if (isTotalQty) {
      sql = `
        WITH totals AS (
          SELECT SUM(l.qty_ordered) as total_qty
          FROM erp_sales_orders so
          LEFT JOIN erp_sales_order_lines l ON so.id = l.sales_order_id
          LEFT JOIN erp_business_partners bp ON so.customer_id = bp.id
          WHERE so.is_deleted = false ${filterConditions}
          GROUP BY so.id
        )
        SELECT CAST(total_qty AS TEXT) as value
        FROM totals
        WHERE total_qty IS NOT NULL
      `;
    } else {
      sql = `
        SELECT DISTINCT ${selectField} as value
        FROM erp_sales_orders so
        LEFT JOIN erp_business_partners bp ON so.customer_id = bp.id
        WHERE so.is_deleted = false ${filterConditions}
      `;
      if (isDateColumn) {
        sql += ` AND ${selectField} IS NOT NULL AND ${selectField} != ''`;
      } else {
        sql += ` AND ${selectField} IS NOT NULL AND CAST(${selectField} AS TEXT) != ''`;
      }
    }

    if (search) {
      const keywords = String(search)
        .split(';')
        .map((k) => k.trim())
        .filter((k) => k);
      if (keywords.length > 0) {
        const conditions: string[] = [];
        for (const kw of keywords) {
          if (isTotalQty) {
            conditions.push(`CAST(total_qty AS TEXT) ILIKE $${paramIdx++}`);
          } else {
            conditions.push(
              `CAST(${selectField} AS TEXT) ILIKE $${paramIdx++}`,
            );
          }
          params.push(`%${kw}%`);
        }
        sql += ` AND (${conditions.join(' OR ')})`;
      }
    }

    if (isTotalQty) {
      sql += ` GROUP BY total_qty ORDER BY total_qty ASC NULLS LAST`;
    } else {
      sql += ` ORDER BY ${selectField} ASC NULLS LAST`;
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as subquery`;
    const totalResult = await this.dataSource.query(countSql, params);
    const total = parseInt(totalResult[0]?.total || '0', 10);

    sql += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(pageSize, (page - 1) * pageSize);

    const itemsResult = await this.dataSource.query(sql, params);
    const items = itemsResult.map((r: any) => r.value);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

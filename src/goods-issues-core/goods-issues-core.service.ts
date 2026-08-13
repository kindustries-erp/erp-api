import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository, In } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpGoodsIssue } from './entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from './entities/erp_goods_issue_line.entity';
import { CreateGoodsIssueDto } from './dto/create-goods-issue.dto';
import { getGMT7YearMonthString } from '../common/utils/date.util';
import { UpdateGoodsIssueDto } from './dto/update-goods-issue.dto';
import { PostGoodsIssueDto } from './dto/post-goods-issue.dto';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpSalesOrder } from '../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../sales-orders-core/entities/erp_sales_order_line.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { ErpProductionOrder } from '../production-core/entities/erp_production_order.entity';
import { ErpProductionOrderMaterial } from '../production-core/entities/erp_production_order_material.entity';
import { ErpSerialLifecycle } from '../inventory-core/entities/erp_serial_lifecycle.entity';
import * as ExcelJS from 'exceljs';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { format } from 'date-fns';

@Injectable()
export class GoodsIssuesCoreService {
  private readonly logger = new Logger(GoodsIssuesCoreService.name);

  private async generateMonthlyIssueNo(manager: any, issueDate?: string) {
    const ym = getGMT7YearMonthString(issueDate);
    const prefix = `XK-${ym}`;
    const latest = await manager
      .getRepository(ErpGoodsIssue)
      .createQueryBuilder('gi')
      .where('gi.issueNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('LENGTH(gi.issueNo)', 'DESC')
      .addOrderBy('gi.issueNo', 'DESC')
      .getOne();
    const latestSeq = latest?.issueNo?.slice(prefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpGoodsIssue)
    private readonly repository: Repository<ErpGoodsIssue>,
    @InjectRepository(ErpGoodsIssueLine)
    private readonly lineRepository: Repository<ErpGoodsIssueLine>,
    private readonly companyProfileService: CompanyProfileService,
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
      ? manager.getRepository(ErpInventoryTrackingSerial)
      : this.dataSource.getRepository(ErpInventoryTrackingSerial);
    const vehicleRepo = manager
      ? manager.getRepository(ErpVehicle)
      : this.dataSource.getRepository(ErpVehicle);
    const itemRepo = manager
      ? manager.getRepository(ErpInventoryItem)
      : this.dataSource.getRepository(ErpInventoryItem);

    const serialIds = [
      ...new Set(lines.map((line) => line.serialId).filter(Boolean)),
    ] as string[];
    const vehicleIds = [
      ...new Set(lines.map((line) => line.vehicleId).filter(Boolean)),
    ] as string[];
    const itemIds = [
      ...new Set(lines.map((line) => line.itemId).filter(Boolean)),
    ] as string[];

    const [serials, vehicles, items]: [
      ErpInventoryTrackingSerial[],
      ErpVehicle[],
      ErpInventoryItem[],
    ] = await Promise.all([
      serialIds.length
        ? serialRepo.findBy(serialIds.map((id) => ({ id })) as any)
        : Promise.resolve([] as ErpInventoryTrackingSerial[]),
      vehicleIds.length
        ? vehicleRepo.findBy(vehicleIds.map((id) => ({ id })) as any)
        : Promise.resolve([] as ErpVehicle[]),
      itemIds.length
        ? itemRepo.findBy(itemIds.map((id) => ({ id })) as any)
        : Promise.resolve([] as ErpInventoryItem[]),
    ]);

    const serialMap = new Map(
      serials.map((row: ErpInventoryTrackingSerial) => [row.id, row]),
    );
    const vehicleMap = new Map(
      vehicles.map((row: ErpVehicle) => [row.id, row]),
    );
    const itemMap = new Map(
      items.map((row: ErpInventoryItem) => [row.id, row]),
    );

    return lines.map((line) => {
      const serial = line.serialId ? serialMap.get(line.serialId) : null;
      const vehicle = line.vehicleId ? vehicleMap.get(line.vehicleId) : null;
      const item = line.itemId ? itemMap.get(line.itemId) : null;
      return {
        ...line,
        serialNo: serial?.serialNo ?? null,
        vehicleVinNo: vehicle?.vinNo ?? null,
        engineNo: vehicle?.engineNo ?? null,
        itemName: item ? `${item.sku} — ${item.itemName}` : null,
      };
    });
  }

  async create(dto: CreateGoodsIssueDto) {
    const { lines = [], ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpGoodsIssue);
      const lineRepo = manager.getRepository(ErpGoodsIssueLine);
      const issueNo =
        header.issueNo?.trim() ||
        (await this.generateMonthlyIssueNo(manager, header.issueDate));
      const headerPayload: DeepPartial<ErpGoodsIssue> = {
        ...header,
        issueNo,
        status: 'DRAFT',
      };
      const data = await headerRepo.save(headerPayload);
      const savedLines: ErpGoodsIssueLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        const linePayload: DeepPartial<ErpGoodsIssueLine> = {
          goodsIssueId: data.id,
          lineNo: lineNo++,
          salesOrderLineId: line.salesOrderLineId ?? null,
          productionOrderMaterialId: line.productionOrderMaterialId ?? null,
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
      const { remarks } = dto as any;
      if (remarks !== undefined) {
        await this.repository.update(id, { remarks });
        await this.dataSource
          .getRepository(ErpInventoryTransaction)
          .update({ documentId: id }, { notes: remarks });
        return { message: 'Cập nhật ghi chú thành công' };
      }
      throw new BadRequestException(
        'Chỉ được sửa phiếu xuất ở trạng thái nháp',
      );
    }
    if (existing.productionOrderId) {
      throw new BadRequestException(
        'Phiếu xuất kho đã gắn với lệnh sản xuất, không được phép sửa',
      );
    }
    const { lines, ...header } = dto as any;
    if (header.issueNo === '') {
      delete header.issueNo;
    }
    const updatePayload = { ...header, status: 'DRAFT' };
    await this.repository.update(id, updatePayload);
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
            productionOrderMaterialId: line.productionOrderMaterialId ?? null,
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
      const moRepo = manager.getRepository(ErpProductionOrder);
      const moMatRepo = manager.getRepository(ErpProductionOrderMaterial);
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
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

      const itemRepo = manager.getRepository(ErpInventoryItem);

      for (const line of lines) {
        const qty = Number(line.qtyIssued || 0);
        if (qty <= 0) {
          throw new BadRequestException(
            `Dòng ${line.lineNo} có số lượng xuất không hợp lệ`,
          );
        }

        let serial: ErpInventoryTrackingSerial | null = null;
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

        const item = line.itemId
          ? await itemRepo.findOne({
              where: { id: line.itemId },
              relations: ['itemType', 'trackingPolicy'],
            })
          : null;
        const isService = item?.itemType?.code === 'SERVICE';

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

        if (!isService && item?.trackingPolicy?.code === 'SERIAL') {
          const inStockCount = await serialRepo.count({
            where: { itemId: line.itemId!, status: 'IN_STOCK' },
          });

          if (inStockCount < qty) {
            const pendingCount = await manager
              .createQueryBuilder()
              .select('COUNT(l.id)', 'cnt')
              .from('erp_goods_receipt_lines', 'l')
              .innerJoin(
                'erp_goods_receipts',
                'gr',
                'gr.id = l.goods_receipt_id',
              )
              .where('l.item_id = :itemId', { itemId: line.itemId })
              .andWhere('gr.status = :status', { status: 'POSTED' })
              .andWhere('l.serials_generated = false')
              .getRawOne();

            if (Number(pendingCount?.cnt || 0) > 0) {
              throw new BadRequestException(
                `Hệ thống đang trong quá trình đăng ký mã Serial cho phụ tùng ${item.sku}. Vui lòng đợi vài phút để hoàn tất, sau đó thực hiện lại lệnh xuất kho.`,
              );
            }
            // else let it fall through to normal balance validation or we can throw here
          }
        }

        if (!isService) {
          if (line.salesOrderLineId) {
            if (currentQty < qty) {
              throw new BadRequestException(
                `Tồn kho không đủ cho dòng ${line.lineNo}`,
              );
            }
          } else if (line.productionOrderMaterialId) {
            if (currentQty < qty) {
              throw new BadRequestException(
                `Tồn kho không đủ cho dòng sản xuất ${line.lineNo}`,
              );
            }
          } else if (availableQty < qty) {
            throw new BadRequestException(
              `Tồn khả dụng không đủ cho dòng ${line.lineNo}`,
            );
          }
        }

        const issueUnitCost = Number(line.unitCost || avgUnitCost || 0);
        const issueValue = qty * issueUnitCost;
        const nextQty = currentQty - qty;
        const nextValue = Math.max(0, currentValue - issueValue);
        const nextAvgUnitCost = nextQty > 0 ? nextValue / nextQty : 0;

        if (!isService) {
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
        }

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

          if (!isService && balance) {
            balance.qtyReserved = Math.max(
              0,
              currentReserved - reservedConsume,
            ).toFixed(3);
          }

          if (serial) {
            serial.salesOrderLineId = soLine.id;
          }
        }

        if (line.productionOrderMaterialId) {
          const moMat = await moMatRepo.findOneBy({
            id: line.productionOrderMaterialId,
          });
          if (!moMat) {
            throw new BadRequestException(
              `Không tìm thấy dòng MO tham chiếu cho dòng xuất ${line.lineNo}`,
            );
          }
          const reservedConsume = Math.min(currentReserved, qty);
          const currentIssued = Number(moMat.qtyIssued || 0);
          moMat.qtyIssued = (currentIssued + qty).toFixed(3);
          await moMatRepo.save(moMat);

          if (!isService && balance) {
            balance.qtyReserved = Math.max(
              0,
              currentReserved - reservedConsume,
            ).toFixed(3);
          }
        }

        if (serial) {
          let dealerId = issue.customerId;
          if (!dealerId && issue.salesOrderId) {
            const soRepo = manager.getRepository(ErpSalesOrder);
            const so = await soRepo.findOneBy({ id: issue.salesOrderId });
            if (so) {
              dealerId = so.customerId;
            }
          }

          serial.goodsIssueLineId = line.id;
          if (line.salesOrderLineId) {
            serial.status = 'DELIVERING';
          }
          if (!serial.vinId && vehicle?.id) {
            serial.vinId = vehicle.id;
          }
          if (line.salesOrderLineId && dealerId) {
            const bpRepo = manager.getRepository(ErpBusinessPartner);
            const dealer = await bpRepo.findOneBy({ id: dealerId });
            if (dealer) {
              serial.attributes = {
                ...(serial.attributes || {}),
                dealer_code: dealer.code,
                dealer_name: dealer.name,
              };
            }
          }
          await serialRepo.save(serial);

          if (line.salesOrderLineId) {
            const lifecycleRepo = manager.getRepository(ErpSerialLifecycle);
            const existingLifecycle = await lifecycleRepo.findOneBy({
              serialId: serial.id,
            });
            if (!existingLifecycle) {
              await lifecycleRepo.save(
                lifecycleRepo.create({
                  serialId: serial.id,
                  salesOrderId: issue.salesOrderId,
                  goodsIssueId: issue.id,
                  dealerId: dealerId,
                  status: 'ACTIVE',
                }),
              );
            } else {
              existingLifecycle.salesOrderId = issue.salesOrderId;
              existingLifecycle.goodsIssueId = issue.id;
              existingLifecycle.dealerId = dealerId;
              existingLifecycle.status = 'ACTIVE';
              await lifecycleRepo.save(existingLifecycle);
            }
          }
        }

        if (vehicle && line.salesOrderLineId) {
          vehicle.status = 'DELIVERING';
          await vehicleRepo.save(vehicle);
        }

        if (!isService && balance) {
          balance.qtyOnHand = nextQty.toFixed(3);
          balance.inventoryValue = nextValue.toFixed(3);
          balance.avgUnitCost = nextAvgUnitCost.toFixed(3);
          await balanceRepo.save(balance);
        }
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
          so.status = 'DELIVERING';
        } else if (anyReserved) {
          so.status = 'PARTIAL_RESERVED';
        } else if (anyDelivered) {
          so.status = 'PARTIAL_DELIVERING';
        } else {
          so.status = 'CONFIRMED';
        }
        await soRepo.save(so);
      }

      const affectedMoIds = new Set<string>();
      if (issue.productionOrderId) {
        affectedMoIds.add(issue.productionOrderId);
      }
      for (const line of lines) {
        if (!line.productionOrderMaterialId) continue;
        const moMat = await moMatRepo.findOneBy({
          id: line.productionOrderMaterialId,
        });
        if (moMat?.productionOrderId) {
          affectedMoIds.add(moMat.productionOrderId);
        }
      }

      for (const moId of affectedMoIds) {
        const mo = await moRepo.findOneBy({ id: moId });
        if (!mo) continue;
        const refreshedMats = await moMatRepo.find({
          where: { productionOrderId: mo.id },
        });
        const anyIssued = refreshedMats.some(
          (m) => Number(m.qtyIssued || 0) > 0,
        );
        if (mo.status !== 'COMPLETED' && mo.status !== 'CANCELLED') {
          if (anyIssued) mo.status = 'IN_PROGRESS';
          await moRepo.save(mo);
        }
      }

      issue.status = 'POSTED';
      await issueRepo.save(issue);

      // --- Journal entry generation removed (accounting module decoupled) ---
      this.logger.log(
        `Goods issue ${issue.issueNo} posted; journal entry generation skipped.`,
      );
      // -----------------------------------------------------------------------

      return this.findOne(id);
    });
  }

  async cancelIssue(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const issueRepo = manager.getRepository(ErpGoodsIssue);
      const lineRepo = manager.getRepository(ErpGoodsIssueLine);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const moRepo = manager.getRepository(ErpProductionOrder);
      const moMatRepo = manager.getRepository(ErpProductionOrderMaterial);
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
      const vehicleRepo = manager.getRepository(ErpVehicle);

      const issue = await this.getIssueOrThrow(issueRepo, id);
      if (issue.status === 'CANCELLED') {
        throw new BadRequestException('Phiếu xuất đã bị hủy trước đó');
      }
      if (issue.status !== 'POSTED') {
        throw new BadRequestException(
          'Chỉ có thể hủy phiếu xuất đã ghi sổ (POSTED)',
        );
      }

      const lines = await lineRepo.find({
        where: { goodsIssueId: id },
        order: { lineNo: 'ASC' },
      });

      const itemRepo = manager.getRepository(ErpInventoryItem);

      for (const line of lines) {
        const qty = Number(line.qtyIssued || 0);
        if (qty <= 0) continue;

        const unitCost = Number(line.unitCost || 0);
        const item = line.itemId
          ? await itemRepo.findOne({
              where: { id: line.itemId },
              relations: ['itemType'],
            })
          : null;
        const isService = item?.itemType?.code === 'SERVICE';

        if (!isService) {
          await txnRepo.save(
            txnRepo.create({
              transactionType: 'ISSUE_CANCEL',
              documentType: 'GOODS_ISSUE',
              documentId: issue.id,
              itemId: line.itemId ?? null,
              warehouseCode: null,
              qtyIn: qty.toFixed(3),
              qtyOut: '0.000',
              unitCost: unitCost.toFixed(3),
              transactionDate: issue.issueDate,
              notes: `Hủy phiếu xuất ${issue.issueNo}`,
              createdBy: null,
            } as any),
          );
        }

        const balance = await balanceRepo.findOne({
          where: { itemId: line.itemId ?? undefined },
        });
        if (balance && !isService) {
          const newQty = Number(balance.qtyOnHand) + qty;
          const newValue = Number(balance.inventoryValue) + qty * unitCost;
          balance.qtyOnHand = newQty.toFixed(3);
          balance.inventoryValue = newValue.toFixed(3);
          balance.avgUnitCost =
            newQty > 0 ? (newValue / newQty).toFixed(3) : '0.000';
          await balanceRepo.save(balance);
        }

        if (line.salesOrderLineId) {
          const soLine = await soLineRepo.findOneBy({
            id: line.salesOrderLineId,
          });
          if (soLine) {
            soLine.qtyDelivered = Math.max(
              0,
              Number(soLine.qtyDelivered) - qty,
            ).toFixed(3);
            await soLineRepo.save(soLine);
          }
          if (balance && !isService) {
            balance.qtyReserved = (Number(balance.qtyReserved) + qty).toFixed(
              3,
            );
            await balanceRepo.save(balance);
          }
        }

        if (line.productionOrderMaterialId) {
          const moMat = await moMatRepo.findOneBy({
            id: line.productionOrderMaterialId,
          });
          if (moMat) {
            moMat.qtyIssued = Math.max(
              0,
              Number(moMat.qtyIssued) - qty,
            ).toFixed(3);
            await moMatRepo.save(moMat);
          }
          if (balance && !isService) {
            balance.qtyReserved = (Number(balance.qtyReserved) + qty).toFixed(
              3,
            );
            await balanceRepo.save(balance);
          }
        }

        if (line.serialId) {
          const serial = await serialRepo.findOneBy({ id: line.serialId });
          if (serial) {
            serial.status = 'AVAILABLE';
            serial.goodsIssueLineId = null;
            await serialRepo.save(serial);
          }
        }

        if (line.vehicleId) {
          const vehicle = await vehicleRepo.findOneBy({ id: line.vehicleId });
          if (vehicle) {
            vehicle.status = 'AVAILABLE';
            await vehicleRepo.save(vehicle);
          }
        }
      }

      // Recalc SO status
      const affectedSoIds = new Set<string>();
      if (issue.salesOrderId) affectedSoIds.add(issue.salesOrderId);
      for (const line of lines) {
        if (!line.salesOrderLineId) continue;
        const soLine = await soLineRepo.findOneBy({
          id: line.salesOrderLineId,
        });
        if (soLine?.salesOrderId) affectedSoIds.add(soLine.salesOrderId);
      }

      for (const salesOrderId of affectedSoIds) {
        const so = await soRepo.findOneBy({ id: salesOrderId });
        if (so) {
          const refreshedLines = await soLineRepo.find({
            where: { salesOrderId: so.id },
          });
          const totalOrdered = refreshedLines.reduce(
            (sum, l) => sum + Number(l.qtyOrdered || 0),
            0,
          );
          const totalDelivered = refreshedLines.reduce(
            (sum, l) => sum + Number(l.qtyDelivered || 0),
            0,
          );

          if (totalDelivered <= 0) {
            so.status = so.status === 'CONFIRMED' ? 'CONFIRMED' : 'DRAFT';
          } else if (totalDelivered < totalOrdered) {
            so.status = 'PARTIAL_DELIVERING';
          } else {
            so.status = 'DELIVERING';
          }
          await soRepo.save(so);
        }
      }

      // Recalc MO status
      const affectedMoIds = new Set<string>();
      if (issue.productionOrderId) affectedMoIds.add(issue.productionOrderId);
      for (const line of lines) {
        if (!line.productionOrderMaterialId) continue;
        const moMat = await moMatRepo.findOneBy({
          id: line.productionOrderMaterialId,
        });
        if (moMat?.productionOrderId)
          affectedMoIds.add(moMat.productionOrderId);
      }

      for (const moId of affectedMoIds) {
        const mo = await moRepo.findOneBy({ id: moId });
        if (mo && mo.status !== 'COMPLETED' && mo.status !== 'CANCELLED') {
          const refreshedMats = await moMatRepo.find({
            where: { productionOrderId: mo.id },
          });
          const anyIssued = refreshedMats.some(
            (m) => Number(m.qtyIssued || 0) > 0,
          );
          mo.status = anyIssued ? 'IN_PROGRESS' : 'CONFIRMED';
          await moRepo.save(mo);
        }
      }

      issue.status = 'CANCELLED';
      const savedIssue = await issueRepo.save(issue);
      const savedLines = await lineRepo.find({
        where: { goodsIssueId: id },
        order: { lineNo: 'ASC' },
      });

      return {
        message: 'Hủy phiếu xuất thành công',
        data: { ...savedIssue, lines: savedLines },
      };
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

  async exportXlsx(id: string): Promise<Buffer> {
    const issueRes = await this.findOne(id);
    if (!issueRes || !issueRes.data) {
      throw new NotFoundException('Không tìm thấy phiếu xuất');
    }
    const issue = issueRes.data;

    const companyProfile = await this.companyProfileService.getProfile();
    const itemIds = issue.lines?.map((l) => l.itemId).filter(Boolean) || [];
    const items = itemIds.length
      ? await this.dataSource
          .getRepository(ErpInventoryItem)
          .findBy({ id: In(itemIds) })
      : [];
    const itemsDict = Object.fromEntries(items.map((i) => [i.id, i]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Phiếu Xuất Kho', {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        margins: {
          left: 0.4,
          right: 0.4,
          top: 0.4,
          bottom: 0.4,
          header: 0.3,
          footer: 0.3,
        },
      },
      views: [{ showGridLines: false }],
    });

    const defaultFont = { name: 'Times New Roman', size: 12 };

    // Header setup
    sheet.getColumn('A').width = 5;
    sheet.getColumn('B').width = 30;
    sheet.getColumn('C').width = 18;
    sheet.getColumn('D').width = 10;
    sheet.getColumn('E').width = 12;
    sheet.getColumn('F').width = 12;
    sheet.getColumn('G').width = 15;
    sheet.getColumn('H').width = 18;

    // Row 1: Company + Form
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = (
      companyProfile?.company_name || 'Đơn vị: ............................'
    ).toUpperCase();
    sheet.getCell('A1').font = { ...defaultFont, bold: true };
    sheet.getCell('A1').alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    };

    sheet.mergeCells('F1:H1');
    sheet.getCell('F1').value = 'Mẫu số 02 - VT';
    sheet.getCell('F1').font = { ...defaultFont, bold: true };
    sheet.getCell('F1').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };
    sheet.getRow(1).height = 25;

    // Row 2: Address + Form sub
    sheet.mergeCells('A2:E2');
    sheet.getCell('A2').value =
      companyProfile?.address || 'Địa chỉ: ............................';
    sheet.getCell('A2').font = defaultFont;
    sheet.getCell('A2').alignment = {
      vertical: 'top',
      horizontal: 'left',
      wrapText: true,
    };

    sheet.mergeCells('F2:H2');
    sheet.getCell('F2').value =
      '(Kèm theo Thông tư số 99/2025/TT-BTC ngày 27 tháng 10 năm 2025 của Bộ trưởng Bộ Tài chính)';
    sheet.getCell('F2').font = { ...defaultFont, italic: true, size: 10 };
    sheet.getCell('F2').alignment = {
      vertical: 'top',
      horizontal: 'center',
      wrapText: true,
    };
    sheet.getRow(2).height = 35;

    // Row 3: Title
    sheet.mergeCells('A4:H4');
    sheet.getCell('A4').value = 'PHIẾU XUẤT KHO';
    sheet.getCell('A4').font = { ...defaultFont, bold: true, size: 16 };
    sheet.getCell('A4').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    // Row 4: Date
    const issueDate = issue.issueDate ? new Date(issue.issueDate) : new Date();
    sheet.mergeCells('A5:H5');
    sheet.getCell('A5').value =
      `Ngày ${format(issueDate, 'dd')} tháng ${format(issueDate, 'MM')} năm ${format(issueDate, 'yyyy')}`;
    sheet.getCell('A5').font = { ...defaultFont, italic: true };
    sheet.getCell('A5').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    // Row 5: Info
    sheet.mergeCells('A6:H6');
    sheet.getCell('A6').value =
      `Số: ${issue.issueNo}        Nợ: ............        Có: ............`;
    sheet.getCell('A6').font = { ...defaultFont, bold: true };
    sheet.getCell('A6').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    sheet.addRow([]);

    const infoRow1 = sheet.addRow([
      `- Họ và tên người nhận hàng: ${(issue as any).customerName || '..............................................'}    Địa chỉ: ........................................`,
    ]);
    sheet.mergeCells(`A${infoRow1.number}:H${infoRow1.number}`);
    infoRow1.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    const infoRow2 = sheet.addRow([
      `- Lý do xuất kho: ${issue.remarks || '..........................................................................................'}`,
    ]);
    sheet.mergeCells(`A${infoRow2.number}:H${infoRow2.number}`);
    infoRow2.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    const infoRow3 = sheet.addRow([
      `- Xuất tại kho (ngăn lô): ...................................................... Địa điểm ............................................................`,
    ]);
    sheet.mergeCells(`A${infoRow3.number}:H${infoRow3.number}`);
    infoRow3.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    sheet.addRow([]);

    // Table Headers
    const headerRow1 = sheet.addRow([
      'STT',
      'Tên, nhãn hiệu, quy cách...',
      'Mã số',
      'Đơn vị tính',
      'Số lượng',
      '',
      'Đơn giá',
      'Thành tiền',
    ]);
    const headerRow2 = sheet.addRow([
      '',
      '',
      '',
      '',
      'Yêu cầu',
      'Thực xuất',
      '',
      '',
    ]);
    const headerRow3 = sheet.addRow(['A', 'B', 'C', 'D', '1', '2', '3', '4']);

    sheet.mergeCells(`A${headerRow1.number}:A${headerRow2.number}`);
    sheet.mergeCells(`B${headerRow1.number}:B${headerRow2.number}`);
    sheet.mergeCells(`C${headerRow1.number}:C${headerRow2.number}`);
    sheet.mergeCells(`D${headerRow1.number}:D${headerRow2.number}`);
    sheet.mergeCells(`E${headerRow1.number}:F${headerRow1.number}`);
    sheet.mergeCells(`G${headerRow1.number}:G${headerRow2.number}`);
    sheet.mergeCells(`H${headerRow1.number}:H${headerRow2.number}`);

    [headerRow1, headerRow2, headerRow3].forEach((row) => {
      row.eachCell((cell) => {
        cell.font = { ...defaultFont, bold: row !== headerRow3 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    let totalQty = 0;
    let totalAmount = 0;

    (issue.lines || []).forEach((line, index) => {
      const item = itemsDict[line.itemId || ''];
      const qty = Number(line.qtyIssued) || 0;
      const cost = Number(line.unitCost) || 0;
      const amount = qty * cost;
      totalQty += qty;
      totalAmount += amount;

      const row = sheet.addRow([
        index + 1,
        item?.itemName || '',
        item?.sku || line.itemId || '',
        '',
        '',
        qty,
        cost,
        amount,
      ]);
      row.eachCell((cell, colNum) => {
        cell.font = defaultFont;
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (colNum === 1 || colNum === 3 || colNum === 4 || colNum === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum >= 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        } else {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true,
          };
        }
      });
    });

    const summaryRow = sheet.addRow([
      'Cộng',
      '',
      '',
      '',
      'x',
      totalQty,
      'x',
      totalAmount,
    ]);
    sheet.mergeCells(`A${summaryRow.number}:D${summaryRow.number}`);
    summaryRow.eachCell((cell, colNum) => {
      cell.font = { ...defaultFont, bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      if (colNum === 1 || colNum === 5 || colNum === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 6 || colNum === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      }
    });

    sheet.addRow([]);
    sheet.addRow([
      '- Tổng số tiền (viết bằng chữ):',
      '........................................................................................................................',
    ]);
    sheet.mergeCells(`B${sheet.lastRow!.number}:H${sheet.lastRow!.number}`);
    sheet.addRow([
      '- Số chứng từ gốc kèm theo:',
      '........................................................................................................................',
    ]);
    sheet.mergeCells(`B${sheet.lastRow!.number}:H${sheet.lastRow!.number}`);

    sheet.addRow([]);
    const dateRow = sheet.addRow([
      '',
      '',
      '',
      '',
      '',
      '',
      `Ngày ${format(issueDate, 'dd')} tháng ${format(issueDate, 'MM')} năm ${format(issueDate, 'yyyy')}`,
    ]);
    sheet.mergeCells(`G${dateRow.number}:H${dateRow.number}`);
    dateRow.getCell('G').font = { ...defaultFont, italic: true };
    dateRow.getCell('G').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    const signRow1 = sheet.addRow([
      'Người lập phiếu',
      '',
      'Người nhận hàng',
      '',
      'Thủ kho',
      '',
      'Kế toán trưởng',
      'Giám đốc',
    ]);
    sheet.mergeCells(`A${signRow1.number}:B${signRow1.number}`);
    sheet.mergeCells(`C${signRow1.number}:D${signRow1.number}`);
    sheet.mergeCells(`E${signRow1.number}:F${signRow1.number}`);
    signRow1.eachCell((cell) => {
      cell.font = { ...defaultFont, bold: true };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
    });

    const signRow2 = sheet.addRow([
      '(Ký, họ tên)',
      '',
      '(Ký, họ tên)',
      '',
      '(Ký, họ tên)',
      '',
      '(Hoặc bộ phận có nhu cầu xuất)',
      '(Ký, họ tên)',
    ]);
    sheet.mergeCells(`A${signRow2.number}:B${signRow2.number}`);
    sheet.mergeCells(`C${signRow2.number}:D${signRow2.number}`);
    sheet.mergeCells(`E${signRow2.number}:F${signRow2.number}`);
    signRow2.eachCell((cell) => {
      cell.font = { ...defaultFont, italic: true, size: 10 };
      cell.alignment = {
        vertical: 'top',
        horizontal: 'center',
        wrapText: true,
      };
    });
    sheet.getRow(signRow2.number).height = 30;

    const signRow3 = sheet.addRow(['', '', '', '', '', '', '(Ký, họ tên)', '']);
    sheet.mergeCells(`A${signRow3.number}:B${signRow3.number}`);
    sheet.mergeCells(`C${signRow3.number}:D${signRow3.number}`);
    sheet.mergeCells(`E${signRow3.number}:F${signRow3.number}`);
    signRow3.eachCell((cell) => {
      cell.font = { ...defaultFont, italic: true, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    signRow3.eachCell((cell) => {
      cell.font = { ...defaultFont, italic: true, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

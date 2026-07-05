import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository, In } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpGoodsReceipt } from './entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from './entities/erp_goods_receipt_line.entity';
import { getGMT7YearMonthString } from '../common/utils/date.util';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { PostGoodsReceiptDto } from './dto/post-goods-receipt.dto';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { ErpProductionOrder } from '../production-core/entities/erp_production_order.entity';
import { ErpProductionOrderMaterial } from '../production-core/entities/erp_production_order_material.entity';
import { DocumentDependenciesCoreService } from '../document-dependencies-core/document-dependencies-core.service';
import { Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { format } from 'date-fns';

@Injectable()
export class GoodsReceiptsCoreService {
  private readonly logger = new Logger(GoodsReceiptsCoreService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpGoodsReceipt)
    private readonly repository: Repository<ErpGoodsReceipt>,
    @InjectRepository(ErpGoodsReceiptLine)
    private readonly lineRepository: Repository<ErpGoodsReceiptLine>,
    private readonly dependencyService: DocumentDependenciesCoreService,
    private readonly companyProfileService: CompanyProfileService,
  ) {}

  private async generateMonthlyReceiptNo(manager: any, receiptDate?: string) {
    const ym = getGMT7YearMonthString(receiptDate);
    const prefix = `NK-${ym}`;
    const latest = await manager
      .getRepository(ErpGoodsReceipt)
      .createQueryBuilder('gr')
      .where('gr.receiptNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('LENGTH(gr.receiptNo)', 'DESC')
      .addOrderBy('gr.receiptNo', 'DESC')
      .getOne();
    const latestSeq = latest?.receiptNo?.slice(prefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  private async getReceiptOrThrow(
    repository: Repository<ErpGoodsReceipt>,
    id: string,
  ) {
    const receipt = await repository.findOneBy({ id, isDeleted: false });
    if (!receipt) {
      throw new NotFoundException('Không tìm thấy phiếu nhập');
    }
    return receipt;
  }

  async getNextReceiptNo(date?: string): Promise<{ nextNo: string }> {
    const nextNo = await this.dataSource.transaction((manager) =>
      this.generateMonthlyReceiptNo(manager, date),
    );
    return { nextNo };
  }

  async create(dto: CreateGoodsReceiptDto) {
    const { lines = [], ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpGoodsReceipt);
      const lineRepo = manager.getRepository(ErpGoodsReceiptLine);
      const receiptNo =
        header.receiptNo?.trim() ||
        (await this.generateMonthlyReceiptNo(manager, header.receiptDate));
      const headerPayload: DeepPartial<ErpGoodsReceipt> = {
        ...header,
        receiptNo,
        status: 'DRAFT',
      };
      const data = await headerRepo.save(headerPayload);
      const savedLines: ErpGoodsReceiptLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        const linePayload: DeepPartial<ErpGoodsReceiptLine> = {
          goodsReceiptId: data.id,
          lineNo: lineNo++,
          purchaseOrderLineId: line.purchaseOrderLineId ?? null,
          itemId: line.itemId ?? null,
          qtyReceived: line.qtyReceived,
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
    const order = resolveSortOrder(query.sort, {
      allowedFields: ['createdAt', 'receiptDate', 'receiptNo', 'status'],
      columnMap: { created_at: 'createdAt', receipt_date: 'receiptDate' },
      defaultOrder: { createdAt: 'DESC' },
    });
    const where = query.search
      ? ([{ receiptNo: ILike(`%${query.search}%`), isDeleted: false }] as any)
      : ({ isDeleted: false } as any);
    const [items, total] = await this.repository.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });
    const supplierIds = [
      ...new Set(items.map((i) => i.supplierId).filter(Boolean)),
    ] as string[];
    let supplierMap = new Map<string, string>();
    if (supplierIds.length > 0) {
      const bpRepo = this.dataSource.getRepository(ErpBusinessPartner);
      const suppliers = await bpRepo.findBy({ id: In(supplierIds) });
      supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    }

    const enrichedItems = items.map((item) => ({
      ...item,
      supplierName: item.supplierId
        ? supplierMap.get(item.supplierId) || null
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
    const data = await this.getReceiptOrThrow(this.repository, id);
    let supplierName: string | null = null;
    if (data.supplierId) {
      const bpRepo = this.dataSource.getRepository(ErpBusinessPartner);
      const supplier = await bpRepo.findOneBy({ id: data.supplierId });
      supplierName = supplier?.name || null;
    }
    const lines = await this.lineRepository.find({
      where: { goodsReceiptId: id },
      order: { lineNo: 'ASC' },
    });
    return {
      message: 'Lấy thông tin thành công',
      data: { ...data, supplierName, lines },
    };
  }

  async update(id: string, dto: UpdateGoodsReceiptDto) {
    const existing = await this.getReceiptOrThrow(this.repository, id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ được sửa phiếu nhập ở trạng thái nháp',
      );
    }

    const { lines, ...header } = dto as any;
    if (header.receiptNo === '') {
      delete header.receiptNo;
    }
    const updatePayload = { ...header, status: 'DRAFT' };
    await this.repository.update(id, updatePayload);
    if (Array.isArray(lines)) {
      await this.dataSource.transaction(async (manager) => {
        const lineRepo = manager.getRepository(ErpGoodsReceiptLine);
        await lineRepo.delete({ goodsReceiptId: id });
        let lineNo = 1;
        for (const line of lines) {
          const linePayload: DeepPartial<ErpGoodsReceiptLine> = {
            goodsReceiptId: id,
            lineNo: lineNo++,
            purchaseOrderLineId: line.purchaseOrderLineId ?? null,
            itemId: line.itemId ?? null,
            qtyReceived: line.qtyReceived,
            unitCost: line.unitCost ?? null,
            amount: line.amount ?? null,
          };
          await lineRepo.save(linePayload);
        }
      });
    }
    return this.findOne(id);
  }

  async postReceipt(id: string, dto: PostGoodsReceiptDto) {
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(ErpGoodsReceipt);
      const lineRepo = manager.getRepository(ErpGoodsReceiptLine);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const poRepo = manager.getRepository(ErpPurchaseOrder);
      const poLineRepo = manager.getRepository(ErpPurchaseOrderLine);
      const moRepo = manager.getRepository(ErpProductionOrder);
      const moMatRepo = manager.getRepository(ErpProductionOrderMaterial);

      const receipt = await this.getReceiptOrThrow(receiptRepo, id);
      if (receipt.status === 'POSTED') {
        throw new BadRequestException('Phiếu nhập đã được ghi nhận trước đó');
      }

      const lines = await lineRepo.find({
        where: { goodsReceiptId: id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) {
        throw new BadRequestException('Chưa nhập hàng nhập kho');
      }

      if (receipt.productionOrderId) {
        const mo = await moRepo.findOneBy({ id: receipt.productionOrderId });
        if (!mo || mo.isDeleted) {
          throw new BadRequestException(
            'Không tìm thấy lệnh sản xuất liên kết',
          );
        }
        const moMaterials = await moMatRepo.find({
          where: { productionOrderId: receipt.productionOrderId },
        });
        const incompleteMaterial = moMaterials.find((material) => {
          const qtyRequired = Number(material.qtyRequired || 0);
          const qtyIssued = Number(material.qtyIssued || 0);
          return qtyRequired > 0 && qtyIssued + 0.0005 < qtyRequired;
        });
        if (incompleteMaterial) {
          throw new BadRequestException(
            'Chưa xuất đủ nguyên vật liệu cho lệnh sản xuất, không thể nhập thành phẩm',
          );
        }
      }

      for (const line of lines) {
        const qty = Number(line.qtyReceived || 0);
        if (qty <= 0) {
          throw new BadRequestException(
            `Dòng ${line.lineNo} có số lượng nhận không hợp lệ`,
          );
        }

        const incomingUnitCost = Number(line.unitCost || 0);
        const balanceWhere: any = {
          itemId: line.itemId ?? undefined,
          warehouseCode: dto.warehouseCode ?? undefined,
        };
        let balance = (await balanceRepo.findOne({
          where: balanceWhere,
        })) as ErpInventoryBalance | null;
        const currentQty = Number(balance?.qtyOnHand || 0);
        const currentValue = Number(balance?.inventoryValue || 0);
        const receiptValue = qty * incomingUnitCost;
        const nextQty = currentQty + qty;
        const nextValue = currentValue + receiptValue;
        const nextAvgUnitCost = nextQty > 0 ? nextValue / nextQty : 0;

        await txnRepo.save(
          txnRepo.create({
            transactionType: 'RECEIPT',
            documentType: 'GOODS_RECEIPT',
            documentId: receipt.id,
            itemId: line.itemId ?? null,
            warehouseCode: dto.warehouseCode ?? null,
            qtyIn: qty.toFixed(3),
            qtyOut: '0.000',
            unitCost: incomingUnitCost.toFixed(3),
            transactionDate: receipt.receiptDate,
            notes: receipt.remarks ?? null,
            createdBy: dto.createdBy ?? receipt.createdBy ?? null,
          } as any),
        );

        if (!balance) {
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

        if (line.purchaseOrderLineId) {
          const poLine = await poLineRepo.findOneBy({
            id: line.purchaseOrderLineId,
          });
          if (!poLine) {
            throw new BadRequestException(
              `Không tìm thấy dòng PO tham chiếu cho dòng nhập ${line.lineNo}`,
            );
          }
          const currentReceived = Number(poLine.qtyReceived || 0);
          const maxAllowed = Number(poLine.qtyOrdered || 0) - currentReceived;
          if (qty > maxAllowed + 0.0005) {
            throw new BadRequestException(
              `Dòng ${line.lineNo}: số lượng nhập (${qty}) vượt quá số lượng còn được nhận (${maxAllowed.toFixed(3)}) của PO`,
            );
          }
          poLine.qtyReceived = (currentReceived + qty).toFixed(3);
          await poLineRepo.save(poLine);
        }
      }

      if (receipt.purchaseOrderId) {
        const po = await poRepo.findOneBy({ id: receipt.purchaseOrderId });
        if (po) {
          const refreshedLines = await poLineRepo.find({
            where: { purchaseOrderId: po.id },
          });
          const allReceived =
            refreshedLines.length > 0 &&
            refreshedLines.every(
              (line) =>
                Number(line.qtyReceived || 0) >= Number(line.qtyOrdered || 0),
            );
          po.status = allReceived ? 'RECEIVED' : 'PARTIAL_RECEIVED';
          await poRepo.save(po);
        }
      }

      if (receipt.productionOrderId) {
        const mo = await moRepo.findOneBy({ id: receipt.productionOrderId });
        if (mo) {
          // Calculate total received qty across all receipt lines for this MO
          const totalReceived = lines.reduce(
            (sum, l) => sum + Number(l.qtyReceived || 0),
            0,
          );
          mo.qtyProduced = (
            Number(mo.qtyProduced || 0) + totalReceived
          ).toFixed(3);
          if (Number(mo.qtyProduced) >= Number(mo.qtyToProduce || 0)) {
            mo.status = 'COMPLETED';
          } else if (Number(mo.qtyProduced) > 0) {
            mo.status = 'IN_PROGRESS';
          }
          await moRepo.save(mo);
        }
      }

      receipt.status = 'POSTED';
      const savedReceipt = await receiptRepo.save(receipt);
      const savedLines = await lineRepo.find({
        where: { goodsReceiptId: id },
        order: { lineNo: 'ASC' },
      });

      // --- Journal entry generation removed (accounting module decoupled) ---
      this.logger.log(
        `Goods receipt ${savedReceipt.receiptNo} posted; journal entry generation skipped.`,
      );
      // -----------------------------------------------------------------------

      return {
        message: 'Lấy thông tin thành công',
        data: { ...savedReceipt, lines: savedLines },
      };
    });
  }

  async cancelReceipt(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(ErpGoodsReceipt);
      const lineRepo = manager.getRepository(ErpGoodsReceiptLine);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const poRepo = manager.getRepository(ErpPurchaseOrder);
      const poLineRepo = manager.getRepository(ErpPurchaseOrderLine);
      const moRepo = manager.getRepository(ErpProductionOrder);

      const receipt = await this.getReceiptOrThrow(receiptRepo, id);
      if (receipt.status === 'CANCELLED') {
        throw new BadRequestException('Phiếu nhập đã bị hủy trước đó');
      }
      if (receipt.status !== 'POSTED') {
        throw new BadRequestException(
          'Chỉ có thể hủy phiếu nhập đã ghi sổ (POSTED)',
        );
      }

      await this.dependencyService.checkDependencies('goods_receipts', id);

      const lines = await lineRepo.find({
        where: { goodsReceiptId: id },
        order: { lineNo: 'ASC' },
      });

      for (const line of lines) {
        const qty = Number(line.qtyReceived || 0);
        if (qty <= 0) continue;

        // Reversal transaction (qty_out)
        const unitCost = Number(line.unitCost || 0);
        await txnRepo.save(
          txnRepo.create({
            transactionType: 'RECEIPT_CANCEL',
            documentType: 'GOODS_RECEIPT',
            documentId: receipt.id,
            itemId: line.itemId ?? null,
            warehouseCode: null,
            qtyIn: '0.000',
            qtyOut: qty.toFixed(3),
            unitCost: unitCost.toFixed(3),
            transactionDate: receipt.receiptDate,
            notes: `Hủy phiếu nhập ${receipt.receiptNo}`,
            createdBy: null,
          } as any),
        );

        // Revert inventory balance
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

        // Revert PO line qty_received
        if (line.purchaseOrderLineId) {
          const poLine = await poLineRepo.findOneBy({
            id: line.purchaseOrderLineId,
          });
          if (poLine) {
            poLine.qtyReceived = Math.max(
              0,
              Number(poLine.qtyReceived) - qty,
            ).toFixed(3);
            await poLineRepo.save(poLine);
          }
        }
      }

      // Recalc PO receipt status
      if (receipt.purchaseOrderId) {
        const po = await poRepo.findOneBy({ id: receipt.purchaseOrderId });
        if (po) {
          const refreshedLines = await poLineRepo.find({
            where: { purchaseOrderId: po.id },
          });
          const totalOrdered = refreshedLines.reduce(
            (sum, l) => sum + Number(l.qtyOrdered || 0),
            0,
          );
          const totalReceived = refreshedLines.reduce(
            (sum, l) => sum + Number(l.qtyReceived || 0),
            0,
          );
          if (totalReceived <= 0) {
            po.status = po.status === 'CONFIRMED' ? 'CONFIRMED' : 'DRAFT';
          } else if (totalReceived < totalOrdered) {
            po.status = 'PARTIAL_RECEIVED';
          } else {
            po.status = 'RECEIVED';
          }
          await poRepo.save(po);
        }
      }

      if (receipt.productionOrderId) {
        const mo = await moRepo.findOneBy({ id: receipt.productionOrderId });
        if (mo) {
          const totalCancelled = lines.reduce(
            (sum, l) => sum + Number(l.qtyReceived || 0),
            0,
          );
          mo.qtyProduced = Math.max(
            0,
            Number(mo.qtyProduced || 0) - totalCancelled,
          ).toFixed(3);

          if (Number(mo.qtyProduced) <= 0) {
            mo.status =
              mo.status === 'IN_PROGRESS' || mo.status === 'COMPLETED'
                ? 'CONFIRMED'
                : mo.status;
          } else if (Number(mo.qtyProduced) < Number(mo.qtyToProduce || 0)) {
            mo.status = 'IN_PROGRESS';
          }
          await moRepo.save(mo);
        }
      }

      receipt.status = 'CANCELLED';
      const savedReceipt = await receiptRepo.save(receipt);
      const savedLines = await lineRepo.find({
        where: { goodsReceiptId: id },
        order: { lineNo: 'ASC' },
      });

      // --- Reverse journal entry generation removed (accounting module decoupled) ---
      this.logger.log(
        `Goods receipt ${savedReceipt.receiptNo} cancelled; reverse journal entry generation skipped.`,
      );
      // ------------------------------------------------------------------------------

      return {
        message: 'Hủy phiếu nhập thành công',
        data: { ...savedReceipt, lines: savedLines },
      };
    });
  }

  async remove(id: string) {
    const existing = await this.repository.findOneBy({ id });
    if (!existing || existing.isDeleted) {
      throw new NotFoundException('Không tìm thấy phiếu nhập');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ được xóa phiếu nhập ở trạng thái nháp',
      );
    }
    existing.isDeleted = true;
    const data = await this.repository.save(existing);
    return {
      message: 'Xóa phiếu nhập thành công',
      data,
    };
  }

  async exportXlsx(id: string): Promise<Buffer> {
    const receiptRes = await this.findOne(id);
    if (!receiptRes || !receiptRes.data) {
      throw new NotFoundException('Không tìm thấy phiếu nhập');
    }
    const receipt = receiptRes.data;

    const companyProfile = await this.companyProfileService.getProfile();
    const itemIds = receipt.lines?.map((l) => l.itemId).filter(Boolean) || [];
    const items = itemIds.length
      ? await this.dataSource
          .getRepository(ErpInventoryItem)
          .findBy({ id: In(itemIds) })
      : [];
    const itemsDict = Object.fromEntries(items.map((i) => [i.id, i]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Phiếu Nhập Kho', {
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
    sheet.getCell('F1').value = 'Mẫu số 01 - VT';
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
    sheet.getCell('A4').value = 'PHIẾU NHẬP KHO';
    sheet.getCell('A4').font = { ...defaultFont, bold: true, size: 16 };
    sheet.getCell('A4').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    // Row 4: Date
    const receiptDate = receipt.receiptDate
      ? new Date(receipt.receiptDate)
      : new Date();
    sheet.mergeCells('A5:H5');
    sheet.getCell('A5').value =
      `Ngày ${format(receiptDate, 'dd')} tháng ${format(receiptDate, 'MM')} năm ${format(receiptDate, 'yyyy')}`;
    sheet.getCell('A5').font = { ...defaultFont, italic: true };
    sheet.getCell('A5').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    // Row 5: Info
    sheet.mergeCells('A6:H6');
    sheet.getCell('A6').value =
      `Số: ${receipt.receiptNo}        Nợ: ............        Có: ............`;
    sheet.getCell('A6').font = { ...defaultFont, bold: true };
    sheet.getCell('A6').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    sheet.addRow([]);

    const infoRow1 = sheet.addRow([
      `- Họ và tên người giao: ${receipt.supplierName || '..................................................................'}`,
    ]);
    sheet.mergeCells(`A${infoRow1.number}:H${infoRow1.number}`);
    infoRow1.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    const infoRow2 = sheet.addRow([
      `- Theo .............................. số: .............. ngày ...... tháng ...... năm ......... của ....................................`,
    ]);
    sheet.mergeCells(`A${infoRow2.number}:H${infoRow2.number}`);
    infoRow2.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    const infoRow3 = sheet.addRow([
      `- Nhập tại kho: ...................................................... địa điểm ............................................................`,
    ]);
    sheet.mergeCells(`A${infoRow3.number}:H${infoRow3.number}`);
    infoRow3.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    const infoRow4 = sheet.addRow([
      `- Ghi chú: ${receipt.remarks || '..................................................................'}`,
    ]);
    sheet.mergeCells(`A${infoRow4.number}:H${infoRow4.number}`);
    infoRow4.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

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
      'Theo chứng từ',
      'Thực nhập',
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

    (receipt.lines || []).forEach((line, index) => {
      const item = itemsDict[line.itemId || ''];
      const qty = Number(line.qtyReceived) || 0;
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
      `Ngày ${format(receiptDate, 'dd')} tháng ${format(receiptDate, 'MM')} năm ${format(receiptDate, 'yyyy')}`,
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
      'Thủ kho',
      '',
      'Kế toán trưởng',
      '',
      'Giám đốc',
      '',
    ]);
    sheet.mergeCells(`A${signRow1.number}:B${signRow1.number}`);
    sheet.mergeCells(`C${signRow1.number}:D${signRow1.number}`);
    sheet.mergeCells(`E${signRow1.number}:F${signRow1.number}`);
    sheet.mergeCells(`G${signRow1.number}:H${signRow1.number}`);
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
      '(Hoặc bộ phận có nhu cầu nhập)',
      '',
      '(Ký, họ tên)',
      '',
    ]);
    sheet.mergeCells(`A${signRow2.number}:B${signRow2.number}`);
    sheet.mergeCells(`C${signRow2.number}:D${signRow2.number}`);
    sheet.mergeCells(`E${signRow2.number}:F${signRow2.number}`);
    sheet.mergeCells(`G${signRow2.number}:H${signRow2.number}`);
    signRow2.eachCell((cell) => {
      cell.font = { ...defaultFont, italic: true, size: 10 };
      cell.alignment = {
        vertical: 'top',
        horizontal: 'center',
        wrapText: true,
      };
    });
    sheet.getRow(signRow2.number).height = 30;

    const signRow3 = sheet.addRow(['', '', '', '', '(Ký, họ tên)', '', '', '']);
    sheet.mergeCells(`A${signRow3.number}:B${signRow3.number}`);
    sheet.mergeCells(`C${signRow3.number}:D${signRow3.number}`);
    sheet.mergeCells(`E${signRow3.number}:F${signRow3.number}`);
    sheet.mergeCells(`G${signRow3.number}:H${signRow3.number}`);
    signRow3.eachCell((cell) => {
      cell.font = { ...defaultFont, italic: true, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

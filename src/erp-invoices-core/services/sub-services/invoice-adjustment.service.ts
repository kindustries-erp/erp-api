import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpInvoiceItem } from '../../entities/erp_invoice_item.entity';
import { ErpInvoiceAdjustmentNetOff } from '../../entities/erp_invoice_adjustment_netoff.entity';
import {
  AdjustmentReconciliationDto,
  FinancialReconciliationDto,
  ItemReconciliationDto,
  InfoDiffReconciliationDto,
  RelatedInvoiceSummaryDto,
  ExecuteAdjustmentNetoffDto,
} from '../../dto/invoice-adjustment-reconciliation.dto';

@Injectable()
export class InvoiceAdjustmentService {
  private readonly logger = new Logger(InvoiceAdjustmentService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
    @InjectRepository(ErpInvoiceItem)
    private readonly invoiceItemRepo: Repository<ErpInvoiceItem>,
    @InjectRepository(ErpInvoiceAdjustmentNetOff)
    private readonly adjustmentNetoffRepo: Repository<ErpInvoiceAdjustmentNetOff>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Truy vấn thông tin đối soát HĐ Điều chỉnh / HĐ Gốc toàn diện:
   * Tài chính, Số lượng từng mặt hàng, và Thông tin điều chỉnh (Effective Data)
   */
  async getAdjustmentReconciliation(
    invoiceId: string,
  ): Promise<AdjustmentReconciliationDto> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, isDeleted: false },
      relations: ['items'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    const isAdjusting =
      invoice.taxInvoiceStatus === 3 ||
      !!(invoice.relatedInvoiceNo && invoice.relatedInvoiceNo.trim());

    if (isAdjusting) {
      return this.buildReconciliationForAdjustingInvoice(invoice);
    }

    // Kiểm tra xem hóa đơn này có phải HĐ Gốc có HĐ ĐC trỏ đến hay không
    return this.buildReconciliationForOriginalInvoice(invoice);
  }

  /**
   * Xây dựng dữ liệu đối soát khi hóa đơn xem xét là Hóa Đơn Điều Chỉnh
   */
  private async buildReconciliationForAdjustingInvoice(
    invoice: ErpInvoice,
  ): Promise<AdjustmentReconciliationDto> {
    const relatedOriginal = await this.findOriginalInvoice(
      invoice.direction,
      invoice.relatedInvoiceNo,
      invoice.relatedSerialNo,
    );

    const relatedInvoices: RelatedInvoiceSummaryDto[] = [];
    let originalAmount = 0;
    let originalItems: ErpInvoiceItem[] = [];
    let originalRemainingDebt = 0;

    if (relatedOriginal) {
      relatedInvoices.push({
        id: relatedOriginal.id,
        invoiceNo: relatedOriginal.invoiceNo,
        serialNo: relatedOriginal.serialNo,
        invoiceDate: relatedOriginal.invoiceDate
          ? String(relatedOriginal.invoiceDate)
          : null,
        totalAmount: Number(relatedOriginal.totalAmount || 0),
        taxInvoiceStatus: relatedOriginal.taxInvoiceStatus,
        relationType: 'ORIGINAL_OF_THIS',
      });
      originalAmount = Number(relatedOriginal.totalAmount || 0);
      originalItems = relatedOriginal.items || [];
      originalRemainingDebt = await this.calculateRemainingDebt(
        relatedOriginal.id,
        originalAmount,
      );
    }

    // Tìm netoff record
    const netoff = await this.adjustmentNetoffRepo.findOne({
      where: { adjustingInvoiceId: invoice.id },
    });

    const adjustingAmount = Number(invoice.totalAmount || 0);
    const offsetAmount = netoff ? Number(netoff.offsetAmount) : 0;
    const isFullyCovered =
      offsetAmount >= Math.abs(adjustingAmount) && offsetAmount > 0;

    const financial: FinancialReconciliationDto = {
      originalAmount,
      adjustedDeltaAmount: adjustingAmount,
      netEffectiveAmount: Math.max(0, originalAmount + adjustingAmount),
      isFullyCancelled:
        originalAmount > 0 && Math.abs(adjustingAmount) >= originalAmount,
      netoffOffsetAmount: offsetAmount,
      remainingDebt: isFullyCovered
        ? 0
        : Math.abs(adjustingAmount) - offsetAmount,
    };

    const itemReconciliations = this.calculateItemReconciliations(
      originalItems,
      invoice.items || [],
    );

    const infoDiff = this.extractInfoDiffFromEffectiveData(
      invoice.effectiveData,
      relatedOriginal,
      invoice,
    );

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      serialNo: invoice.serialNo,
      taxInvoiceStatus: invoice.taxInvoiceStatus,
      role: 'ADJUSTING',
      financial,
      itemReconciliations,
      infoDiff,
      relatedInvoices,
    };
  }

  /**
   * Xây dựng dữ liệu đối soát khi hóa đơn xem xét là Hóa Đơn Gốc
   */
  private async buildReconciliationForOriginalInvoice(
    invoice: ErpInvoice,
  ): Promise<AdjustmentReconciliationDto> {
    const adjustingInvoices = await this.findAdjustingInvoices(
      invoice.direction,
      invoice.invoiceNo,
      invoice.serialNo,
    );

    const relatedInvoices: RelatedInvoiceSummaryDto[] = adjustingInvoices.map(
      (adj) => ({
        id: adj.id,
        invoiceNo: adj.invoiceNo,
        serialNo: adj.serialNo,
        invoiceDate: adj.invoiceDate ? String(adj.invoiceDate) : null,
        totalAmount: Number(adj.totalAmount || 0),
        taxInvoiceStatus: adj.taxInvoiceStatus,
        relationType: 'ADJUSTING_FOR_THIS',
      }),
    );

    const originalAmount = Number(invoice.totalAmount || 0);
    let totalAdjustedDelta = 0;
    const allAdjustingItems: ErpInvoiceItem[] = [];

    for (const adj of adjustingInvoices) {
      totalAdjustedDelta += Number(adj.totalAmount || 0);
      if (adj.items && adj.items.length > 0) {
        allAdjustingItems.push(...adj.items);
      }
    }

    const netoffRecords = await this.adjustmentNetoffRepo.find({
      where: { originalInvoiceId: invoice.id },
    });
    const totalOffset = netoffRecords.reduce(
      (sum, r) => sum + Number(r.offsetAmount || 0),
      0,
    );

    const remainingDebt = await this.calculateRemainingDebt(
      invoice.id,
      originalAmount,
      totalOffset,
    );

    const role =
      invoice.taxInvoiceStatus === 5 || adjustingInvoices.length > 0
        ? 'ORIGINAL'
        : 'STANDARD';

    const financial: FinancialReconciliationDto = {
      originalAmount,
      adjustedDeltaAmount: totalAdjustedDelta,
      netEffectiveAmount: Math.max(0, originalAmount + totalAdjustedDelta),
      isFullyCancelled:
        originalAmount > 0 && Math.abs(totalAdjustedDelta) >= originalAmount,
      netoffOffsetAmount: totalOffset,
      remainingDebt,
    };

    const itemReconciliations = this.calculateItemReconciliations(
      invoice.items || [],
      allAdjustingItems,
    );

    const infoDiff = this.extractInfoDiffFromEffectiveData(
      invoice.effectiveData,
      invoice,
      adjustingInvoices[0] || null,
    );

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      serialNo: invoice.serialNo,
      taxInvoiceStatus: invoice.taxInvoiceStatus,
      role,
      financial,
      itemReconciliations,
      infoDiff,
      relatedInvoices,
    };
  }

  /**
   * Tính toán chênh lệch số lượng từng mặt hàng
   */
  private calculateItemReconciliations(
    originalItems: ErpInvoiceItem[],
    adjustingItems: ErpInvoiceItem[],
  ): ItemReconciliationDto[] {
    const resultMap = new Map<string, ItemReconciliationDto>();

    // 1. Thêm các dòng ban đầu từ HĐ Gốc
    for (const orig of originalItems) {
      const key = orig.itemCode || orig.description || `item-${orig.id}`;
      const origQty = Number(orig.quantity || 0);
      const unitPrice = Number(orig.unitPrice || 0);
      resultMap.set(key, {
        itemCode: orig.itemCode,
        description: orig.description || 'Mặt hàng',
        originalQty: origQty,
        adjustedDeltaQty: 0,
        netEffectiveQty: origQty,
        unit: orig.unit,
        unitPrice,
        netAmount: Number(orig.totalAmount || 0),
      });
    }

    // 2. Ghép các dòng từ HĐ Điều Chỉnh
    for (const adj of adjustingItems) {
      const key = adj.itemCode || adj.description || `item-${adj.id}`;
      const adjQty = Number(adj.quantity || 0);
      const adjAmount = Number(adj.totalAmount || 0);

      const existing = resultMap.get(key);
      if (existing) {
        existing.adjustedDeltaQty += adjQty;
        existing.netEffectiveQty = Math.max(
          0,
          existing.originalQty + existing.adjustedDeltaQty,
        );
        existing.netAmount += adjAmount;
      } else {
        resultMap.set(key, {
          itemCode: adj.itemCode,
          description: adj.description || 'Mặt hàng điều chỉnh',
          originalQty: 0,
          adjustedDeltaQty: adjQty,
          netEffectiveQty: Math.max(0, adjQty),
          unit: adj.unit,
          unitPrice: Number(adj.unitPrice || 0),
          netAmount: adjAmount,
        });
      }
    }

    return Array.from(resultMap.values());
  }

  /**
   * Trích xuất thông tin điều chỉnh (Info Diffs)
   */
  private extractInfoDiffFromEffectiveData(
    effectiveData: any,
    origInvoice: ErpInvoice | null,
    adjInvoice: ErpInvoice | null,
  ): InfoDiffReconciliationDto {
    const diffs: Array<{
      field: string;
      fieldNameVi: string;
      oldValue: string;
      newValue: string;
    }> = [];

    if (
      effectiveData &&
      effectiveData.infoDiffs &&
      Array.isArray(effectiveData.infoDiffs)
    ) {
      for (const d of effectiveData.infoDiffs) {
        diffs.push({
          field: d.field || 'unknown',
          fieldNameVi: d.fieldNameVi || d.field || 'Thông tin',
          oldValue: d.oldValue || '',
          newValue: d.newValue || '',
        });
      }
    }

    // Nếu không có effectiveData nhưng có ghi chú điều chỉnh từ HĐ Điều Chỉnh
    if (diffs.length === 0 && adjInvoice && adjInvoice.notes) {
      const notes = adjInvoice.notes;
      if (
        notes.includes('Điều chỉnh') ||
        notes.includes('thông tin') ||
        notes.includes('MST')
      ) {
        diffs.push({
          field: 'notes',
          fieldNameVi: 'Ghi chú điều chỉnh',
          oldValue: origInvoice?.buyerName || '',
          newValue: notes,
        });
      }
    }

    return {
      hasInfoAdjustment: diffs.length > 0,
      diffs,
    };
  }

  /**
   * Tính toán dư nợ thực tế của HĐ gốc sau khi trừ phiếu thu/chi và cấn trừ HĐ điều chỉnh
   */
  private async calculateRemainingDebt(
    invoiceId: string,
    totalAmount: number,
    cachedOffset?: number,
  ): Promise<number> {
    // 1. Lấy tổng tiền đã thanh toán qua chứng từ / ngân hàng
    const voucherQuery = await this.dataSource.query(
      `SELECT COALESCE(SUM(net_off_amount), 0) as paid 
       FROM erp_invoice_voucher_netoff 
       WHERE invoice_id = $1`,
      [invoiceId],
    );
    const voucherPaid = Number(voucherQuery?.[0]?.paid || 0);

    // 2. Lấy tổng offset từ HĐ điều chỉnh nếu chưa có
    let adjustmentOffset = cachedOffset;
    if (adjustmentOffset === undefined) {
      const adjQuery = await this.dataSource.query(
        `SELECT COALESCE(SUM(offset_amount), 0) as offset 
         FROM erp_invoice_adjustment_netoff 
         WHERE original_invoice_id = $1`,
        [invoiceId],
      );
      adjustmentOffset = Number(adjQuery?.[0]?.offset || 0);
    }

    return Math.max(0, totalAmount - voucherPaid - (adjustmentOffset || 0));
  }

  /**
   * Tìm HĐ Gốc theo số hóa đơn và ký hiệu
   */
  private async findOriginalInvoice(
    direction: string,
    invoiceNo: string | null,
    serialNo: string | null,
  ): Promise<ErpInvoice | null> {
    if (!invoiceNo) return null;
    const cleanNo = invoiceNo.trim().replace(/^0+/, '');
    const cleanSerial = serialNo ? serialNo.trim() : null;

    let query = this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.items', 'items')
      .where('inv.direction = :direction', { direction })
      .andWhere('inv.isDeleted = false')
      .andWhere(
        "(inv.invoiceNo = :invoiceNo OR LTRIM(inv.invoiceNo, '0') = :cleanNo)",
        { invoiceNo, cleanNo },
      );

    if (cleanSerial) {
      query = query.andWhere(
        '(inv.serialNo = :serialNo OR inv.serialNo = :cleanSerial)',
        { serialNo, cleanSerial },
      );
    }

    return query.getOne();
  }

  /**
   * Tìm danh sách HĐ Điều Chỉnh trỏ vào HĐ Gốc
   */
  private async findAdjustingInvoices(
    direction: string,
    invoiceNo: string,
    serialNo: string | null,
  ): Promise<ErpInvoice[]> {
    const cleanNo = invoiceNo.trim().replace(/^0+/, '');
    const cleanSerial = serialNo ? serialNo.trim() : null;

    let query = this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.items', 'items')
      .where('inv.direction = :direction', { direction })
      .andWhere('inv.isDeleted = false')
      .andWhere(
        "(inv.relatedInvoiceNo = :invoiceNo OR LTRIM(inv.relatedInvoiceNo, '0') = :cleanNo)",
        { invoiceNo, cleanNo },
      );

    if (cleanSerial) {
      query = query.andWhere(
        '(inv.relatedSerialNo = :serialNo OR inv.relatedSerialNo = :cleanSerial)',
        { serialNo, cleanSerial },
      );
    }

    return query.getMany();
  }

  /**
   * Thực hiện hoặc cập nhật cấn trừ công nợ giữa HĐ Điều Chỉnh và HĐ Gốc
   */
  async executeAdjustmentNetoff(dto: ExecuteAdjustmentNetoffDto): Promise<{
    success: boolean;
    netoffId: string;
    offsetAmount: number;
    message: string;
  }> {
    const { originalInvoiceId, adjustingInvoiceId, offsetAmount, notes } = dto;

    return this.dataSource.transaction(async (manager) => {
      const original = await manager.findOne(ErpInvoice, {
        where: { id: originalInvoiceId, isDeleted: false },
      });
      const adjusting = await manager.findOne(ErpInvoice, {
        where: { id: adjustingInvoiceId, isDeleted: false },
      });

      if (!original || !adjusting) {
        throw new NotFoundException('Original or Adjusting invoice not found');
      }

      const origAmount = Number(original.totalAmount || 0);
      const adjAmount = Number(adjusting.totalAmount || 0);
      const targetOffset =
        offsetAmount !== undefined
          ? offsetAmount
          : Math.min(origAmount, Math.abs(adjAmount));

      let netoff = await manager.findOne(ErpInvoiceAdjustmentNetOff, {
        where: {
          originalInvoiceId: original.id,
          adjustingInvoiceId: adjusting.id,
        },
      });

      if (!netoff) {
        netoff = manager.create(ErpInvoiceAdjustmentNetOff, {
          originalInvoiceId: original.id,
          adjustingInvoiceId: adjusting.id,
          offsetAmount: targetOffset,
          offsetType: adjAmount < 0 ? 'REDUCTION' : 'INCREASE',
          notes:
            notes ||
            `Tự động cấn trừ HĐ ĐC ${adjusting.invoiceNo} vào HĐ Gốc ${original.invoiceNo}`,
        });
      } else {
        netoff.offsetAmount = targetOffset;
        if (notes) netoff.notes = notes;
      }

      await manager.save(netoff);

      // Cập nhật effective_data cho HĐ Gốc nếu HĐ ĐC có diff thông tin
      if (
        adjusting.effectiveData?.infoDiffs &&
        adjusting.effectiveData.infoDiffs.length > 0
      ) {
        const effectiveValues = original.effectiveData?.effectiveValues || {};
        for (const diff of adjusting.effectiveData.infoDiffs) {
          if (diff.field === 'buyerTaxCode')
            effectiveValues.buyerTaxCode = diff.newValue;
          if (diff.field === 'buyerName')
            effectiveValues.buyerName = diff.newValue;
          if (diff.field === 'buyerAddress')
            effectiveValues.buyerAddress = diff.newValue;
        }

        original.effectiveData = {
          hasInfoAdjustment: true,
          infoDiffs: adjusting.effectiveData.infoDiffs,
          effectiveValues,
          lastAdjustedAt: new Date().toISOString(),
          lastAdjustingInvoiceId: adjusting.id,
        };
        await manager.save(original);
      }

      this.logger.log(
        `Executed adjustment netoff: HĐ ${adjusting.invoiceNo} -> HĐ ${original.invoiceNo} (Offset: ${targetOffset}đ)`,
      );

      return {
        success: true,
        netoffId: netoff.id,
        offsetAmount: targetOffset,
        message: `Cấn trừ thành công ${targetOffset.toLocaleString('vi-VN')}đ`,
      };
    });
  }
}

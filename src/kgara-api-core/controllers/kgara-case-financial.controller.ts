import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request as Req,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { DocumentTraceabilityService } from '../../common/services/document-traceability.service';
import { GarageSmartSettlementService } from '../services/garage-smart-settlement.service';
import { KgaraCaseQueryService } from '../services/kgara-case-query.service';
import { extractNetPayableAmount } from '../kgara-sync.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraCaseFinancialController {
  private readonly logger = new Logger(KgaraCaseFinancialController.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
    private readonly traceabilityService: DocumentTraceabilityService,
    private readonly smartSettlementService: GarageSmartSettlementService,
    private readonly caseQueryService: KgaraCaseQueryService,
  ) {}

  @Get('cases/:id/linked-invoices')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getLinkedInvoices(@Param('id') id: string) {
    return this.linkedInvoiceRepo.query(
      `SELECT l.*, 
              i.invoice_no as "invoiceNo", 
              i.seller_name as "sellerName", 
              i.buyer_name as "buyerName",
              i.direction as "direction",
              i.total_amount as "totalAmount",
              i.pre_vat_amount as "preVatAmount",
              i.vat_amount as "vatAmount",
              i.description as "description"
       FROM kgara_case_linked_invoice l
       LEFT JOIN erp_invoices i ON l."invoiceId" = i.id
       WHERE l."caseDbId"::text = $1
       ORDER BY l."createdAt" DESC`,
      [id],
    );
  }

  @Post('cases/:id/linked-invoices')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async addLinkedInvoice(
    @Param('id') id: string,
    @Body()
    body:
      | { invoiceId: string; linkType: 'IN' | 'OUT'; note?: string }
      | {
          items: Array<{
            invoiceId: string;
            linkType: 'IN' | 'OUT';
            note?: string;
          }>;
        }
      | Array<{ invoiceId: string; linkType: 'IN' | 'OUT'; note?: string }>,
  ) {
    const rawItems: Array<{
      invoiceId: string;
      linkType: 'IN' | 'OUT';
      note?: string;
    }> = Array.isArray(body)
      ? body
      : (body as any)?.items && Array.isArray((body as any).items)
        ? (body as any).items
        : [body as any];

    const results: any[] = [];
    for (const item of rawItems) {
      if (!item?.invoiceId) continue;
      const existing = await this.linkedInvoiceRepo.findOne({
        where: { caseDbId: id, invoiceId: item.invoiceId },
      });
      let link = existing;
      if (!existing) {
        link = this.linkedInvoiceRepo.create({
          caseDbId: id,
          invoiceId: item.invoiceId,
          linkType: item.linkType || 'OUT',
          note: item.note,
        });
        link = await this.linkedInvoiceRepo.save(link);
      }
      if (link) {
        results.push(link);
      }

      // Auto-sync 2 chiều khi liên kết Hóa đơn <-> Phiếu dịch vụ:
      try {
        const isOut = item.linkType === 'OUT';
        const targetSettlementType = isOut ? 'RECEIPT' : 'PAYMENT';

        // 1. Chiều Case -> Invoice: Nếu Case đã có sao kê ON_SYSTEM, cấn trừ sang Hóa đơn
        const settlements = await this.settlementRepo.find({
          where: {
            caseId: id,
            sourceChannel: 'ON_SYSTEM',
            settlementType: targetSettlementType,
          },
        });

        for (const s of settlements) {
          if (s.bankTransactionId) {
            const netOff = await this.settlementRepo.manager.query(
              `SELECT id FROM erp_invoice_voucher_netoff WHERE invoice_id = $1 AND bank_transaction_id = $2 LIMIT 1`,
              [item.invoiceId, s.bankTransactionId],
            );
            if (!netOff || netOff.length === 0) {
              await this.settlementRepo.manager.query(
                `INSERT INTO erp_invoice_voucher_netoff (id, invoice_id, bank_transaction_id, net_off_amount, created_at, updated_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, now(), now())`,
                [item.invoiceId, s.bankTransactionId, Number(s.amount || 0)],
              );
            }
          }
        }

        // 2. Chiều Invoice -> Case: Nếu Hóa đơn đã có cấn trừ sao kê sẵn, cấn trừ sang Phiếu dịch vụ
        const invoiceNetOffs = await this.settlementRepo.manager.query(
          `SELECT n.bank_transaction_id, n.net_off_amount, t.trans_date, t.correspondent_name, t.description
           FROM erp_invoice_voucher_netoff n
           LEFT JOIN erp_bank_transactions t ON t.id = n.bank_transaction_id
           WHERE n.invoice_id = $1`,
          [item.invoiceId],
        );

        for (const no of invoiceNetOffs) {
          if (!no.bank_transaction_id) continue;
          const existingCaseSettlement = await this.settlementRepo.findOne({
            where: {
              caseId: id,
              bankTransactionId: no.bank_transaction_id,
            },
          });

          if (!existingCaseSettlement) {
            const newSettlement = this.settlementRepo.create({
              caseId: id,
              bankTransactionId: no.bank_transaction_id,
              settlementType: targetSettlementType,
              sourceChannel: 'ON_SYSTEM',
              amount: Number(no.net_off_amount || 0),
              transDate: no.trans_date,
              partnerName: no.correspondent_name,
              note: `Đồng bộ cấn trừ từ hóa đơn liên kết`,
            });
            await this.settlementRepo.save(newSettlement);
          }
        }

        await this.caseQueryService.recalculateCaseSettlementSummary(id);
      } catch (syncErr) {
        this.logger.warn(
          `Could not sync bi-directional settlements and netoff: ${syncErr}`,
        );
      }
    }

    return Array.isArray(body) || (body as any)?.items ? results : results[0];
  }

  @Get('invoices/:invoiceId/linked-cases')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getLinkedCases(@Param('invoiceId') invoiceId: string) {
    return this.linkedInvoiceRepo.query(
      `SELECT l.*, 
              c.so_chung_tu as "soChungTu", 
              c.bien_so_xe as "bienSoXe", 
              c.khach_hang_name as "khachHangName"
       FROM kgara_case_linked_invoice l
       LEFT JOIN kgara_cases c ON l."caseDbId" = c.id
       WHERE l."invoiceId"::text = $1
       ORDER BY l."createdAt" DESC`,
      [invoiceId],
    );
  }

  @Delete('cases/:id/linked-invoices/:linkedId')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.DELETE,
  })
  async removeLinkedInvoice(
    @Param('id') id: string,
    @Param('linkedId') linkedId: string,
  ) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      linkedId.startsWith('tmp-') ||
      linkedId.startsWith('manual-tmp-') ||
      id.startsWith('tmp-') ||
      (process.env.NODE_ENV !== 'test' &&
        (!uuidRegex.test(linkedId) || !uuidRegex.test(id)))
    ) {
      return { success: true, message: 'Ignored non-persisted temporary ID' };
    }

    const link = await this.linkedInvoiceRepo.findOne({
      where: { id: linkedId, caseDbId: id },
    });
    if (link) {
      try {
        const settlements = await this.settlementRepo.find({
          where: { caseId: id, sourceChannel: 'ON_SYSTEM' },
        });
        const txnIds = settlements
          .map((s) => s.bankTransactionId)
          .filter((tid): tid is string => !!tid);
        if (txnIds.length > 0) {
          await this.linkedInvoiceRepo.manager.query(
            `DELETE FROM erp_invoice_voucher_netoff WHERE invoice_id = $1 AND bank_transaction_id = ANY($2::uuid[])`,
            [link.invoiceId, txnIds],
          );
        }
      } catch (delSyncErr) {
        this.logger.warn(`Could not clean up invoice netoff: ${delSyncErr}`);
      }
      await this.linkedInvoiceRepo.delete({ id: linkedId, caseDbId: id });
      await this.caseQueryService.recalculateCaseSettlementSummary(id);
    }
    return { success: true };
  }

  @Get('cases/:id/traceability-graph')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseTraceabilityGraph(@Param('id') id: string, @Req() req: any) {
    return this.traceabilityService.getGarageCaseTraceabilityGraph(
      id,
      req.user,
    );
  }

  @Get('cases/:id/financial-summary')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseFinancialSummary(@Param('id') id: string) {
    const c = await this.caseRepo.findOne({
      where: [{ id }, { soChungTu: id }, { hdPhieuDichVuId: id }],
    });
    if (!c) throw new NotFoundException('Không tìm thấy phiếu dịch vụ');

    const gp = await this.grossProfitRepo.findOne({
      where: [
        { hdPhieuDichVuId: c.hdPhieuDichVuId },
        { vuViecCode: c.soChungTu || undefined },
      ],
    });

    const isCompleted = c.tinhTrangDichVu === 3;
    const totalPayable = extractNetPayableAmount(c);
    const targetRevenue = totalPayable;
    const targetCost = Number(c.chiPhi ?? gp?.chiPhi ?? 0);
    const expectedProfit = isCompleted
      ? Number(c.loiNhuan ?? gp?.loiNhuan ?? targetRevenue - targetCost)
      : null;

    // Direct Settlements is the single source of truth for cashflow & payments
    const settlements = await this.settlementRepo.find({
      where: { caseId: c.id },
      order: { createdAt: 'DESC' },
    });

    let directReceiptOnSystem = 0;
    let directReceiptOffSystem = 0;
    let directPaymentOnSystem = 0;
    let directPaymentOffSystem = 0;

    for (const s of settlements) {
      const amt = Number(s.amount || 0);
      if (s.settlementType === 'RECEIPT') {
        if (s.sourceChannel === 'ON_SYSTEM') {
          directReceiptOnSystem += amt;
        } else {
          directReceiptOffSystem += amt;
        }
      } else {
        if (s.sourceChannel === 'ON_SYSTEM') {
          directPaymentOnSystem += amt;
        } else {
          directPaymentOffSystem += amt;
        }
      }
    }

    const totalCollected = directReceiptOnSystem + directReceiptOffSystem;
    const remainingReceivable = Math.max(0, targetRevenue - totalCollected);
    const isOverCollected = totalCollected > targetRevenue && targetRevenue > 0;
    const overCollectedAmount = isOverCollected
      ? totalCollected - targetRevenue
      : 0;

    const totalPaid = directPaymentOnSystem + directPaymentOffSystem;
    const remainingPayable = Math.max(0, targetCost - totalPaid);

    const realizedCashProfit = totalCollected - totalPaid;
    const kgaraPaidAmount = Number(c.tienDaThanhToan || 0);
    const reconciliationDiscrepancy = Math.abs(
      kgaraPaidAmount - totalCollected,
    );
    const hasDiscrepancy = reconciliationDiscrepancy > 1000;

    return {
      caseId: c.id,
      soChungTu: c.soChungTu,
      tinhTrangDichVu: c.tinhTrangDichVu,
      tenTinhTrangDichVu: c.tenTinhTrangDichVu,
      isCompleted,
      targetRevenue,
      targetCost,
      expectedProfit,
      breakdown: {
        receipts: {
          directReceiptOnSystem,
          directReceiptOffSystem,
          totalCollected,
          remainingReceivable,
          isOverCollected,
          overCollectedAmount,
        },
        payments: {
          directPaymentOnSystem,
          directPaymentOffSystem,
          totalPaid,
          remainingPayable,
        },
        realizedCashProfit,
      },
      reconciliation: {
        kgaraPaidAmount,
        erpCollectedAmount: totalCollected,
        discrepancy: reconciliationDiscrepancy,
        hasDiscrepancy,
        status: hasDiscrepancy ? 'MISMATCH' : 'MATCHED',
      },
    };
  }

  @Get('cases/:id/settlements')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseSettlements(@Param('id') id: string) {
    return this.settlementRepo.query(
      `SELECT s.id::text as "id", 
              s.case_id::text as "caseId",
              s.bank_transaction_id::text as "bankTransactionId",
              s.settlement_type::text as "settlementType",
              s.source_channel::text as "sourceChannel",
              s.category::text as "category",
              s.amount::numeric as "amount",
              s.trans_date as "transDate",
              s.partner_name::text as "partnerName",
              s.note::text as "note",
              s.created_at as "createdAt",
              t.reference_number::text as "referenceNumber",
              t.source_type::text as "sourceType",
              t.correspondent_name::text as "correspondentName",
              b.bank_name::text as "bankName",
              b.account_number::text as "accountNumber",
              c.name::text as "cashBookName"
       FROM kgara_case_settlements s
       LEFT JOIN erp_bank_transactions t ON s.bank_transaction_id = t.id
       LEFT JOIN erp_bank_accounts b ON t.bank_account_id = b.id
       LEFT JOIN erp_cash_books c ON t.cash_book_id = c.id
       WHERE s.case_id::text = $1
       ORDER BY s.created_at DESC`,
      [id],
    );
  }

  @Get('cases/:id/smart-settlement-suggestions')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getSmartSettlementSuggestions(
    @Param('id') id: string,
    @Query('type') type?: 'RECEIPT' | 'PAYMENT',
  ) {
    return this.smartSettlementService.getSuggestionsForCase(
      id,
      type || 'RECEIPT',
    );
  }

  @Get('cases/:id/smart-invoice-suggestions')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getSmartInvoiceSuggestions(
    @Param('id') id: string,
    @Query('direction') direction?: 'IN' | 'OUT',
  ) {
    return this.smartSettlementService.getInvoiceSuggestionsForCase(
      id,
      direction || 'OUT',
    );
  }

  @Post('cases/:id/settlements')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async addCaseSettlement(
    @Param('id') id: string,
    @Body()
    body: {
      bankTransactionId?: string;
      settlementType: 'RECEIPT' | 'PAYMENT';
      sourceChannel?: 'ON_SYSTEM' | 'OFF_SYSTEM_MANUAL';
      category?: string;
      amount: number;
      transDate?: string;
      partnerName?: string;
      note?: string;
    },
  ) {
    const sourceChannel =
      body.sourceChannel ||
      (body.bankTransactionId ? 'ON_SYSTEM' : 'OFF_SYSTEM_MANUAL');

    const settlement = this.settlementRepo.create({
      caseId: id,
      bankTransactionId: body.bankTransactionId || undefined,
      settlementType: body.settlementType,
      sourceChannel,
      category: body.category,
      amount: body.amount,
      transDate: body.transDate,
      partnerName: body.partnerName,
      note: body.note,
    });
    const saved = await this.settlementRepo.save(settlement);

    // Auto-cấn trừ 2 chiều: Nếu giao dịch là ON_SYSTEM (Sao kê ngân hàng / Sổ quỹ)
    // Tự động tìm hóa đơn liên kết của vụ việc có hướng tương ứng và cấn trừ vào Hóa đơn
    if (sourceChannel === 'ON_SYSTEM' && body.bankTransactionId) {
      try {
        const isOut = body.settlementType === 'RECEIPT';
        const targetDirection = isOut ? 'OUT' : 'IN';
        const linkedInvoices = await this.linkedInvoiceRepo.query(
          `SELECT DISTINCT i.id, i.total_amount as "totalAmount"
           FROM erp_invoices i
           LEFT JOIN kgara_case_linked_invoice l ON l."invoiceId" = i.id
           WHERE (l."caseDbId"::text = $1 OR i.settlement_order = $1)
             AND (i.direction = $2 OR l."linkType" = $2)
             AND i.is_deleted = false`,
          [id, targetDirection],
        );

        for (const inv of linkedInvoices) {
          const netOff = await this.settlementRepo.manager.query(
            `SELECT id FROM erp_invoice_voucher_netoff WHERE invoice_id = $1 AND bank_transaction_id = $2 LIMIT 1`,
            [inv.id, body.bankTransactionId],
          );
          if (!netOff || netOff.length === 0) {
            await this.settlementRepo.manager.query(
              `INSERT INTO erp_invoice_voucher_netoff (id, invoice_id, bank_transaction_id, net_off_amount, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, $3, now(), now())`,
              [inv.id, body.bankTransactionId, Number(body.amount || 0)],
            );
          }
        }
      } catch (syncErr) {
        this.logger.warn(
          `Could not sync case settlement to invoice netoff: ${syncErr}`,
        );
      }
    }

    await this.caseQueryService.recalculateCaseSettlementSummary(id);
    return saved;
  }

  @Delete('cases/:id/settlements/:settlementId')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.DELETE,
  })
  async removeCaseSettlement(
    @Param('id') id: string,
    @Param('settlementId') settlementId: string,
  ) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      settlementId.startsWith('tmp-') ||
      settlementId.startsWith('manual-tmp-') ||
      id.startsWith('tmp-') ||
      (process.env.NODE_ENV !== 'test' &&
        (!uuidRegex.test(settlementId) || !uuidRegex.test(id)))
    ) {
      return { success: true, message: 'Ignored non-persisted temporary ID' };
    }

    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId, caseId: id },
    });

    if (settlement && settlement.bankTransactionId) {
      try {
        const linkedInvoices = await this.linkedInvoiceRepo.query(
          `SELECT DISTINCT i.id
           FROM erp_invoices i
           LEFT JOIN kgara_case_linked_invoice l ON l."invoiceId" = i.id
           WHERE (l."caseDbId"::text = $1 OR i.settlement_order = $1)
             AND i.is_deleted = false`,
          [id],
        );
        const invIds = linkedInvoices.map((i: any) => i.id).filter(Boolean);
        if (invIds.length > 0) {
          await this.settlementRepo.manager.query(
            `DELETE FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = $1 AND invoice_id = ANY($2::uuid[])`,
            [settlement.bankTransactionId, invIds],
          );
        }
      } catch (delSyncErr) {
        this.logger.warn(
          `Could not clean up invoice netoff on settlement delete: ${delSyncErr}`,
        );
      }
    }

    await this.settlementRepo.delete({ id: settlementId, caseId: id });
    await this.caseQueryService.recalculateCaseSettlementSummary(id);
    return { success: true };
  }

  @Patch('cases/:id/settlements/:settlementId')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.UPDATE,
  })
  async updateCaseSettlement(
    @Param('id') id: string,
    @Param('settlementId') settlementId: string,
    @Body()
    body: {
      amount?: number;
      category?: string;
      note?: string;
      transDate?: string;
      partnerName?: string;
    },
  ) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      settlementId.startsWith('tmp-') ||
      settlementId.startsWith('manual-tmp-') ||
      id.startsWith('tmp-') ||
      (process.env.NODE_ENV !== 'test' &&
        (!uuidRegex.test(settlementId) || !uuidRegex.test(id)))
    ) {
      return { success: true, message: 'Ignored non-persisted temporary ID' };
    }

    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId, caseId: id },
    });

    if (!settlement) {
      throw new NotFoundException(
        `Không tìm thấy cấn trừ ${settlementId} của vụ việc ${id}`,
      );
    }

    if (settlement.sourceChannel === 'ON_SYSTEM') {
      throw new BadRequestException(
        'Sao kê ngân hàng chỉ có thể thêm hoặc xóa, không chỉnh sửa trực tiếp.',
      );
    }

    const oldAmount = Number(settlement.amount || 0);

    if (body.category !== undefined) settlement.category = body.category;
    if (body.note !== undefined) settlement.note = body.note;
    if (body.transDate !== undefined) settlement.transDate = body.transDate;
    if (body.partnerName !== undefined)
      settlement.partnerName = body.partnerName;
    if (body.amount !== undefined) settlement.amount = Number(body.amount);

    const saved = await this.settlementRepo.save(settlement);

    if (
      body.amount !== undefined &&
      Number(body.amount) !== oldAmount &&
      settlement.bankTransactionId
    ) {
      try {
        const linkedInvoices = await this.linkedInvoiceRepo.query(
          `SELECT DISTINCT i.id
           FROM erp_invoices i
           LEFT JOIN kgara_case_linked_invoice l ON l."invoiceId" = i.id
           WHERE (l."caseDbId"::text = $1 OR i.settlement_order = $1)
             AND i.is_deleted = false`,
          [id],
        );
        const invIds = linkedInvoices.map((i: any) => i.id).filter(Boolean);
        if (invIds.length > 0) {
          await this.settlementRepo.manager.query(
            `UPDATE erp_invoice_voucher_netoff
             SET net_off_amount = $1, updated_at = now()
             WHERE bank_transaction_id = $2 AND invoice_id = ANY($3::uuid[])`,
            [Number(body.amount), settlement.bankTransactionId, invIds],
          );
        }
      } catch (updateSyncErr) {
        this.logger.warn(
          `Could not update invoice netoff on settlement update: ${updateSyncErr}`,
        );
      }
    }

    await this.caseQueryService.recalculateCaseSettlementSummary(id);
    return saved;
  }
}

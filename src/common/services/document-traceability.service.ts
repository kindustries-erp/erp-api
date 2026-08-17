import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RbacCoreService } from '../../rbac-core/rbac-core.service';
import {
  TraceabilityGraphDto,
  TraceabilityNodeDto,
  TraceabilityEdgeDto,
  TraceabilityNodeType,
  TraceabilityRelationType,
  TraceabilitySummaryDto,
} from '../dto/document-traceability.dto';

interface RawNodeItem {
  id: string;
  docType: TraceabilityNodeType;
  docNo: string;
  title: string;
  date?: string | null;
  amount?: number | null;
  netOffAmount?: number | null;
  status?: string | null;
  statusVariant?: 'default' | 'secondary' | 'outline' | 'danger' | 'warning';
  partnerName?: string | null;
  depth: number;
  metadata?: Record<string, unknown>;
}

interface RawEdgeItem {
  id: string;
  source: string;
  target: string;
  relationType: TraceabilityRelationType;
  label?: string | null;
  amount?: number | null;
  isTransitive: boolean;
}

@Injectable()
export class DocumentTraceabilityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rbacService: RbacCoreService,
  ) {}

  /**
   * Main entry point to get Traceability Graph starting from an Invoice
   */
  async getInvoiceTraceabilityGraph(
    invoiceId: string,
    user?: any,
  ): Promise<TraceabilityGraphDto> {
    return this.buildGraph('INVOICE', invoiceId, user);
  }

  /**
   * Main entry point to get Traceability Graph starting from a Bank Transaction / Cash Book Entry
   */
  async getBankTransactionTraceabilityGraph(
    transactionId: string,
    user?: any,
  ): Promise<TraceabilityGraphDto> {
    return this.buildGraph('BANK_TXN', transactionId, user);
  }

  /**
   * Universal Multi-hop BFS Traceability Graph Builder
   */
  async buildGraph(
    rootType: TraceabilityNodeType,
    rootId: string,
    user?: any,
  ): Promise<TraceabilityGraphDto> {
    const rawNodesMap = new Map<string, RawNodeItem>();
    const rawEdgesMap = new Map<string, RawEdgeItem>();

    // 1. Fetch Root Document
    if (rootType === 'INVOICE') {
      const inv = await this.fetchInvoice(rootId);
      if (!inv) throw new NotFoundException('Không tìm thấy hóa đơn');
      rawNodesMap.set(inv.id, { ...inv, depth: 0 });
    } else if (rootType === 'BANK_TXN') {
      const txn = await this.fetchBankTransaction(rootId);
      if (!txn)
        throw new NotFoundException('Không tìm thấy giao dịch ngân hàng');
      rawNodesMap.set(txn.id, { ...txn, depth: 0 });
    }

    // 2. Discover Direct & Transitive Relationships (BFS Traversal)
    const visited = new Set<string>([rootId]);
    const queue: { id: string; type: TraceabilityNodeType; depth: number }[] = [
      { id: rootId, type: rootType, depth: 0 },
    ];

    const MAX_DEPTH = 3; // PO -> Goods Receipt -> Invoice -> Bank Txn -> Journal Entry

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= MAX_DEPTH) continue;

      if (current.type === 'INVOICE') {
        await this.expandInvoiceNode(
          current.id,
          current.depth,
          rawNodesMap,
          rawEdgesMap,
          queue,
          visited,
        );
      } else if (current.type === 'BANK_TXN') {
        await this.expandBankTransactionNode(
          current.id,
          current.depth,
          rawNodesMap,
          rawEdgesMap,
          queue,
          visited,
        );
      } else if (current.type === 'PURCHASE_ORDER') {
        await this.expandPurchaseOrderNode(
          current.id,
          current.depth,
          rawNodesMap,
          rawEdgesMap,
          queue,
          visited,
        );
      } else if (current.type === 'SALES_ORDER') {
        await this.expandSalesOrderNode(
          current.id,
          current.depth,
          rawNodesMap,
          rawEdgesMap,
          queue,
          visited,
        );
      } else if (current.type === 'GARAGE_CASE') {
        await this.expandGarageCaseNode(
          current.id,
          current.depth,
          rawNodesMap,
          rawEdgesMap,
          queue,
          visited,
        );
      }
    }

    // 3. Apply Multi-Tier RBAC & Data Sanitization on Nodes
    const nodes: TraceabilityNodeDto[] = [];
    const userId = user?.sub || user?.id;

    for (const [nodeId, rawNode] of rawNodesMap.entries()) {
      const requiredResource = this.getResourceForDocType(rawNode.docType);
      const isCurrent = nodeId === rootId;

      // Root node permission is already guaranteed by Controller Guard
      let hasPerm = isCurrent;
      if (!hasPerm && userId) {
        hasPerm = await this.rbacService.hasPermission(
          userId,
          requiredResource,
          'read',
        );
      } else if (!hasPerm && !userId) {
        // Fallback for unauthenticated/system tasks
        hasPerm = true;
      }

      if (hasPerm) {
        nodes.push({
          id: rawNode.id,
          docType: rawNode.docType,
          docNo: rawNode.docNo,
          title: rawNode.title,
          date: rawNode.date,
          amount: rawNode.amount,
          netOffAmount: rawNode.netOffAmount,
          status: rawNode.status,
          statusVariant: rawNode.statusVariant,
          isCurrent,
          depth: rawNode.depth,
          partnerName: rawNode.partnerName,
          hasPermission: true,
          restricted: false,
          requiredResource,
          metadata: rawNode.metadata,
        });
      } else {
        // Sanitized / Masked Bridge Node
        nodes.push({
          id: rawNode.id,
          docType: rawNode.docType,
          docNo: '***',
          title: 'Chứng từ bảo mật',
          date: rawNode.date ? rawNode.date.slice(0, 7) : null, // Muted month-only or null
          amount: null,
          netOffAmount: null,
          status: 'RESTRICTED',
          statusVariant: 'outline',
          isCurrent,
          depth: rawNode.depth,
          partnerName: null,
          hasPermission: false,
          restricted: true,
          requiredResource,
          metadata: {},
        });
      }
    }

    const edges: TraceabilityEdgeDto[] = Array.from(rawEdgesMap.values());

    // 4. Calculate Summary Statistics
    const rootNode = rawNodesMap.get(rootId);
    const totalAmount = rootNode?.amount || 0;
    let directCount = 0;
    let transitiveCount = 0;

    for (const node of nodes) {
      if (node.id === rootId) continue;
      if (node.depth === 1) directCount++;
      else transitiveCount++;
    }

    const totalNetOffAmount = edges
      .filter((e) => e.relationType === 'NET_OFF')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const summary: TraceabilitySummaryDto = {
      totalAmount,
      totalNetOffAmount,
      matchRatio:
        totalAmount > 0
          ? Math.min(100, Math.round((totalNetOffAmount / totalAmount) * 100))
          : 0,
      directCount,
      transitiveCount,
    };

    return {
      rootId,
      rootType,
      nodes,
      edges,
      summary,
    };
  }

  // ─── Entity Fetchers & Expanders ─────────────────────────────────────────────

  private async fetchInvoice(id: string): Promise<RawNodeItem | null> {
    const rows = await this.dataSource.query(
      `SELECT id, invoice_no, serial_no, direction, invoice_date, total_amount, status, seller_name, buyer_name, purchase_order_id, sales_order_id, journal_entry_id
       FROM erp_invoices WHERE id = $1 AND is_deleted = false LIMIT 1`,
      [id],
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    const partner = r.direction === 'IN' ? r.seller_name : r.buyer_name;

    return {
      id: r.id,
      docType: 'INVOICE',
      docNo: r.invoice_no,
      title:
        `HĐ ${r.direction === 'IN' ? 'đầu vào' : 'đầu ra'} ${r.serial_no ? '(' + r.serial_no + ')' : ''}`.trim(),
      date: r.invoice_date,
      amount: r.total_amount ? Number(r.total_amount) : 0,
      status: r.status,
      statusVariant:
        r.status === 'CONFIRMED' || r.status === 'ACTIVE'
          ? 'default'
          : r.status === 'CANCELLED'
            ? 'danger'
            : 'secondary',
      partnerName: partner,
      depth: 0,
      metadata: {
        direction: r.direction,
        serialNo: r.serial_no,
        purchaseOrderId: r.purchase_order_id,
        salesOrderId: r.sales_order_id,
        journalEntryId: r.journal_entry_id,
      },
    };
  }

  private async fetchBankTransaction(id: string): Promise<RawNodeItem | null> {
    const rows = await this.dataSource.query(
      `SELECT t.id, t.source_type, t.trans_date, t.debit_amount, t.credit_amount, t.reference_number, t.description, t.correspondent_name, b.bank_name, b.account_number, c.name as cash_book_name
       FROM erp_bank_transactions t
       LEFT JOIN erp_bank_accounts b ON t.bank_account_id = b.id
       LEFT JOIN erp_cash_books c ON t.cash_book_id = c.id
       WHERE t.id = $1 AND t.is_deleted = false LIMIT 1`,
      [id],
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    const isCredit = Number(r.credit_amount || 0) > 0;
    const amount = isCredit
      ? Number(r.credit_amount)
      : Number(r.debit_amount || 0);
    const sourceLabel =
      r.source_type === 'BANK'
        ? `${r.bank_name || 'Ngân hàng'} - ${r.account_number || ''}`.trim()
        : r.cash_book_name || 'Sổ quỹ';

    return {
      id: r.id,
      docType: 'BANK_TXN',
      docNo:
        r.reference_number ||
        (isCredit ? 'GBC' : 'UNC') + `-${r.id.slice(0, 8)}`,
      title: `${r.source_type === 'BANK' ? (isCredit ? 'Giấy báo có' : 'Ủy nhiệm chi') : 'Phiếu ' + (isCredit ? 'thu' : 'chi')} (${sourceLabel})`,
      date: r.trans_date
        ? new Date(r.trans_date).toISOString().slice(0, 10)
        : null,
      amount,
      status: 'RECORDED',
      statusVariant: 'default',
      partnerName: r.correspondent_name,
      depth: 0,
      metadata: {
        sourceType: r.source_type,
        isCredit,
        description: r.description,
      },
    };
  }

  private async expandInvoiceNode(
    invoiceId: string,
    currentDepth: number,
    nodes: Map<string, RawNodeItem>,
    edges: Map<string, RawEdgeItem>,
    queue: { id: string; type: TraceabilityNodeType; depth: number }[],
    visited: Set<string>,
  ) {
    const invNode = nodes.get(invoiceId);
    const meta = invNode?.metadata || {};

    // 1. Check Purchase Order (Upstream)
    if (meta.purchaseOrderId) {
      const poId = meta.purchaseOrderId as string;
      if (!nodes.has(poId)) {
        const poRows = await this.dataSource.query(
          `SELECT po.id, po.po_no, po.order_date, po.total_amount, po.status, p.name as supplier_name
           FROM erp_purchase_orders po
           LEFT JOIN erp_business_partners p ON po.supplier_id = p.id
           WHERE po.id = $1 AND po.is_deleted = false LIMIT 1`,
          [poId],
        );
        if (poRows && poRows.length > 0) {
          const po = poRows[0];
          nodes.set(po.id, {
            id: po.id,
            docType: 'PURCHASE_ORDER',
            docNo: po.po_no,
            title: `Đơn mua hàng (PO)`,
            date: po.order_date,
            amount: Number(po.total_amount || 0),
            status: po.status,
            statusVariant: po.status === 'COMPLETED' ? 'default' : 'secondary',
            partnerName: po.supplier_name,
            depth: currentDepth + 1,
          });
          if (!visited.has(po.id)) {
            visited.add(po.id);
            queue.push({
              id: po.id,
              type: 'PURCHASE_ORDER',
              depth: currentDepth + 1,
            });
          }
        }
      }
      const edgeId = `e-po-${poId}-inv-${invoiceId}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: poId,
          target: invoiceId,
          relationType: 'INVOICED_FROM',
          label: 'Xuất hóa đơn từ PO',
          isTransitive: currentDepth > 0,
        });
      }
    }

    // 2. Check Sales Order (Upstream)
    if (meta.salesOrderId) {
      const soId = meta.salesOrderId as string;
      if (!nodes.has(soId)) {
        const soRows = await this.dataSource.query(
          `SELECT so.id, so.order_no, so.order_date, so.total_amount, so.status, p.name as customer_name
           FROM erp_sales_orders so
           LEFT JOIN erp_business_partners p ON so.customer_id = p.id
           WHERE so.id = $1 AND so.is_deleted = false LIMIT 1`,
          [soId],
        );
        if (soRows && soRows.length > 0) {
          const so = soRows[0];
          nodes.set(so.id, {
            id: so.id,
            docType: 'SALES_ORDER',
            docNo: so.order_no,
            title: `Đơn bán hàng (SO)`,
            date: so.order_date,
            amount: Number(so.total_amount || 0),
            status: so.status,
            statusVariant: so.status === 'COMPLETED' ? 'default' : 'secondary',
            partnerName: so.customer_name,
            depth: currentDepth + 1,
          });
          if (!visited.has(so.id)) {
            visited.add(so.id);
            queue.push({
              id: so.id,
              type: 'SALES_ORDER',
              depth: currentDepth + 1,
            });
          }
        }
      }
      const edgeId = `e-so-${soId}-inv-${invoiceId}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: soId,
          target: invoiceId,
          relationType: 'INVOICED_FROM',
          label: 'Xuất hóa đơn từ SO',
          isTransitive: currentDepth > 0,
        });
      }
    }

    // 3. Check Bank Transaction Net-Offs (Downstream/Upstream)
    const netOffRows = await this.dataSource.query(
      `SELECT n.id as netoff_id, n.net_off_amount, t.id as txn_id, t.source_type, t.trans_date, t.debit_amount, t.credit_amount, t.reference_number, t.correspondent_name, b.bank_name, b.account_number, c.name as cash_book_name
       FROM erp_invoice_voucher_netoff n
       JOIN erp_bank_transactions t ON n.bank_transaction_id = t.id
       LEFT JOIN erp_bank_accounts b ON t.bank_account_id = b.id
       LEFT JOIN erp_cash_books c ON t.cash_book_id = c.id
       WHERE n.invoice_id = $1 AND t.is_deleted = false`,
      [invoiceId],
    );

    for (const r of netOffRows) {
      const isCredit = Number(r.credit_amount || 0) > 0;
      const totalTxnAmount = isCredit
        ? Number(r.credit_amount)
        : Number(r.debit_amount || 0);
      const netOffAmt = Number(r.net_off_amount || 0);
      const sourceLabel =
        r.source_type === 'BANK'
          ? `${r.bank_name || 'Ngân hàng'} - ${r.account_number || ''}`.trim()
          : r.cash_book_name || 'Sổ quỹ';

      if (!nodes.has(r.txn_id)) {
        nodes.set(r.txn_id, {
          id: r.txn_id,
          docType: 'BANK_TXN',
          docNo:
            r.reference_number ||
            (isCredit ? 'GBC' : 'UNC') + `-${r.txn_id.slice(0, 8)}`,
          title: `${r.source_type === 'BANK' ? (isCredit ? 'Giấy báo có' : 'Ủy nhiệm chi') : 'Phiếu ' + (isCredit ? 'thu' : 'chi')} (${sourceLabel})`,
          date: r.trans_date
            ? new Date(r.trans_date).toISOString().slice(0, 10)
            : null,
          amount: totalTxnAmount,
          netOffAmount: netOffAmt,
          status: 'MATCHED',
          statusVariant: 'default',
          partnerName: r.correspondent_name,
          depth: currentDepth + 1,
        });
        if (!visited.has(r.txn_id)) {
          visited.add(r.txn_id);
          queue.push({
            id: r.txn_id,
            type: 'BANK_TXN',
            depth: currentDepth + 1,
          });
        }
      }

      const edgeId = `e-inv-${invoiceId}-txn-${r.txn_id}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: invoiceId,
          target: r.txn_id,
          relationType: 'NET_OFF',
          label: `Cấn trừ: ${netOffAmt.toLocaleString('vi-VN')} ₫`,
          amount: netOffAmt,
          isTransitive: currentDepth > 0,
        });
      }
    }

    // 4. Check Accounting Journal Entry (GL)
    if (meta.journalEntryId) {
      const glId = meta.journalEntryId as string;
      if (!nodes.has(glId)) {
        const glRows = await this.dataSource.query(
          `SELECT id, entry_no, date, description, status FROM erp_journal_entries WHERE id = $1 AND is_deleted = false LIMIT 1`,
          [glId],
        );
        if (glRows && glRows.length > 0) {
          const gl = glRows[0];
          nodes.set(gl.id, {
            id: gl.id,
            docType: 'JOURNAL_ENTRY',
            docNo: gl.entry_no,
            title: `Bút toán sổ cái (${gl.entry_no})`,
            date: gl.date ? new Date(gl.date).toISOString().slice(0, 10) : null,
            amount: invNode?.amount || 0,
            status: gl.status || 'POSTED',
            statusVariant: 'default',
            depth: currentDepth + 1,
          });
        }
      }
      const edgeId = `e-inv-${invoiceId}-gl-${glId}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: invoiceId,
          target: glId,
          relationType: 'JOURNAL_POSTED',
          label: 'Hạch toán sổ cái',
          isTransitive: currentDepth > 0,
        });
      }
    }
  }

  private async expandBankTransactionNode(
    txnId: string,
    currentDepth: number,
    nodes: Map<string, RawNodeItem>,
    edges: Map<string, RawEdgeItem>,
    queue: { id: string; type: TraceabilityNodeType; depth: number }[],
    visited: Set<string>,
  ) {
    // 1. Expand Invoices connected via Net-Off
    const invRows = await this.dataSource.query(
      `SELECT n.id as netoff_id, n.net_off_amount, i.id as invoice_id, i.invoice_no, i.serial_no, i.direction, i.invoice_date, i.total_amount, i.status, i.seller_name, i.buyer_name, i.purchase_order_id, i.sales_order_id, i.journal_entry_id
       FROM erp_invoice_voucher_netoff n
       JOIN erp_invoices i ON n.invoice_id = i.id
       WHERE n.bank_transaction_id = $1 AND i.is_deleted = false`,
      [txnId],
    );

    for (const r of invRows) {
      const partner = r.direction === 'IN' ? r.seller_name : r.buyer_name;
      const netOffAmt = Number(r.net_off_amount || 0);

      if (!nodes.has(r.invoice_id)) {
        nodes.set(r.invoice_id, {
          id: r.invoice_id,
          docType: 'INVOICE',
          docNo: r.invoice_no,
          title:
            `HĐ ${r.direction === 'IN' ? 'đầu vào' : 'đầu ra'} ${r.serial_no ? '(' + r.serial_no + ')' : ''}`.trim(),
          date: r.invoice_date,
          amount: r.total_amount ? Number(r.total_amount) : 0,
          netOffAmount: netOffAmt,
          status: r.status,
          statusVariant:
            r.status === 'CONFIRMED' || r.status === 'ACTIVE'
              ? 'default'
              : 'secondary',
          partnerName: partner,
          depth: currentDepth + 1,
          metadata: {
            direction: r.direction,
            serialNo: r.serial_no,
            purchaseOrderId: r.purchase_order_id,
            salesOrderId: r.sales_order_id,
            journalEntryId: r.journal_entry_id,
          },
        });

        if (!visited.has(r.invoice_id)) {
          visited.add(r.invoice_id);
          queue.push({
            id: r.invoice_id,
            type: 'INVOICE',
            depth: currentDepth + 1,
          });
        }
      }

      const edgeId = `e-inv-${r.invoice_id}-txn-${txnId}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: r.invoice_id,
          target: txnId,
          relationType: 'NET_OFF',
          label: `Cấn trừ: ${netOffAmt.toLocaleString('vi-VN')} ₫`,
          amount: netOffAmt,
          isTransitive: currentDepth > 0,
        });
      }
    }

    // 2. Expand Journal Entry of Bank Transaction
    const glRows = await this.dataSource.query(
      `SELECT id, entry_no, date, description, status FROM erp_journal_entries
       WHERE source_id = $1 AND is_deleted = false LIMIT 1`,
      [txnId],
    );

    if (glRows && glRows.length > 0) {
      const gl = glRows[0];
      if (!nodes.has(gl.id)) {
        nodes.set(gl.id, {
          id: gl.id,
          docType: 'JOURNAL_ENTRY',
          docNo: gl.entry_no,
          title: `Bút toán dòng tiền (${gl.entry_no})`,
          date: gl.date ? new Date(gl.date).toISOString().slice(0, 10) : null,
          status: gl.status || 'POSTED',
          statusVariant: 'default',
          depth: currentDepth + 1,
        });
      }

      const edgeId = `e-txn-${txnId}-gl-${gl.id}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: txnId,
          target: gl.id,
          relationType: 'JOURNAL_POSTED',
          label: 'Hạch toán sổ cái',
          isTransitive: currentDepth > 0,
        });
      }
    }
  }

  private async expandPurchaseOrderNode(
    poId: string,
    currentDepth: number,
    nodes: Map<string, RawNodeItem>,
    edges: Map<string, RawEdgeItem>,
    queue: { id: string; type: TraceabilityNodeType; depth: number }[],
    visited: Set<string>,
  ) {
    // Expand Goods Receipts of PO (Phiếu nhập kho)
    const grRows = await this.dataSource.query(
      `SELECT id, receipt_no, receipt_date, status, total_amount FROM erp_goods_receipts
       WHERE purchase_order_id = $1 AND is_deleted = false`,
      [poId],
    );

    for (const gr of grRows) {
      if (!nodes.has(gr.id)) {
        nodes.set(gr.id, {
          id: gr.id,
          docType: 'GOODS_RECEIPT',
          docNo: gr.receipt_no,
          title: `Phiếu nhập kho (NK)`,
          date: gr.receipt_date,
          amount: Number(gr.total_amount || 0),
          status: gr.status,
          statusVariant: gr.status === 'COMPLETED' ? 'default' : 'secondary',
          depth: currentDepth + 1,
        });
      }

      const edgeId = `e-po-${poId}-gr-${gr.id}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: poId,
          target: gr.id,
          relationType: 'RECEIPT_OF',
          label: 'Nhập kho',
          isTransitive: currentDepth > 0,
        });
      }
    }
  }

  private async expandSalesOrderNode(
    soId: string,
    currentDepth: number,
    nodes: Map<string, RawNodeItem>,
    edges: Map<string, RawEdgeItem>,
    queue: { id: string; type: TraceabilityNodeType; depth: number }[],
    visited: Set<string>,
  ) {
    // Expand Goods Issues of SO (Phiếu xuất kho)
    const giRows = await this.dataSource.query(
      `SELECT id, issue_no, issue_date, status, total_amount FROM erp_goods_issues
       WHERE sales_order_id = $1 AND is_deleted = false`,
      [soId],
    );

    for (const gi of giRows) {
      if (!nodes.has(gi.id)) {
        nodes.set(gi.id, {
          id: gi.id,
          docType: 'GOODS_ISSUE',
          docNo: gi.issue_no,
          title: `Phiếu xuất kho (XK)`,
          date: gi.issue_date,
          amount: Number(gi.total_amount || 0),
          status: gi.status,
          statusVariant: gi.status === 'COMPLETED' ? 'default' : 'secondary',
          depth: currentDepth + 1,
        });
      }

      const edgeId = `e-so-${soId}-gi-${gi.id}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: soId,
          target: gi.id,
          relationType: 'ISSUE_OF',
          label: 'Xuất kho',
          isTransitive: currentDepth > 0,
        });
      }
    }
  }

  private async expandGarageCaseNode(
    caseId: string,
    currentDepth: number,
    nodes: Map<string, RawNodeItem>,
    edges: Map<string, RawEdgeItem>,
    queue: { id: string; type: TraceabilityNodeType; depth: number }[],
    visited: Set<string>,
  ) {
    // Empty placeholder for garage case expander
  }

  private getResourceForDocType(docType: TraceabilityNodeType): string {
    switch (docType) {
      case 'INVOICE':
        return 'invoices';
      case 'BANK_TXN':
        return 'bank_statements';
      case 'PURCHASE_ORDER':
        return 'purchase_orders';
      case 'SALES_ORDER':
        return 'sales_orders';
      case 'GOODS_RECEIPT':
      case 'GOODS_ISSUE':
        return 'inventory_items';
      case 'JOURNAL_ENTRY':
        return 'journal_entries';
      case 'GARAGE_CASE':
        return 'garage';
      default:
        return '*';
    }
  }
}

import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createDirectus,
  readItem,
  readItems,
  createItem,
  updateItem,
  rest,
  staticToken,
} from '@directus/sdk';
import * as XLSX from 'xlsx';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { rethrowHttpException } from '../common/utils/directus-error.util';
import {
  CreateErpItemDto,
  UpdateErpItemDto,
  CreateErpPoDto,
  UpdateErpPoDto,
  CreateErpReceiptDto,
  CreateErpVehicleDto,
  UpdateErpVehicleDto,
  CreateErpIssueDto,
  ActivateErpWarrantyDto,
  ErpMfgQueryDto,
} from './dto/erp-manufacturing.dto';

// ─── Template cột Excel mẫu cho PO import ─────────────────────────────────────
const PO_TEMPLATE_HEADERS = [
  'supplier_code',
  'branch_code',
  'document_date',
  'expected_receipt_date',
  'notes',
  'item_code',
  'ordered_qty',
  'unit_price',
  'line_notes',
];

const PO_TEMPLATE_EXAMPLE_ROWS = [
  [
    'NCC001',
    'CN01',
    '2026-01-15',
    '2026-01-30',
    'Nhập linh kiện tháng 1',
    'LK-MOTOR-001',
    '10',
    '1500000',
    'Mô tơ 250W',
  ],
  [
    'NCC001',
    'CN01',
    '2026-01-15',
    '2026-01-30',
    '',
    'LK-FRAME-RED-L',
    '5',
    '800000',
    'Khung xe đỏ cỡ L',
  ],
];

@Injectable()
export class ErpManufacturingService {
  private readonly logger = new Logger(ErpManufacturingService.name);

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private getClient(userToken: string) {
    const url = this.configService.getOrThrow<string>('DIRECTUS_URL');
    return createDirectus(url).with(staticToken(userToken)).with(rest());
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  private buildFilter(query: ErpMfgQueryDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter['status'] = { _eq: query.status };
    if (query.branch_id) filter['branch_id'] = { _eq: query.branch_id };
    if (query.supplier_id) filter['supplier_id'] = { _eq: query.supplier_id };
    if (query.tracking_type)
      filter['tracking_type'] = { _eq: query.tracking_type };
    return filter;
  }

  private generateNo(prefix: string): string {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const t = String(now.getTime()).slice(-5);
    return `${prefix}${y}${m}${d}-${t}`;
  }

  // ─── Item master ──────────────────────────────────────────────────────────────

  async listItems(query: ErpMfgQueryDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const page = query.page ?? 1;
      const limit = query.pageSize ?? 20;
      const result = await (client as any).request(
        (readItems as any)('erp_inventory_items', {
          filter: this.buildFilter(query),
          limit,
          page,
          sort: [query.sort ?? '-created_at'],
          search: query.search,
          meta: 'total_count,filter_count',
        }),
      );
      return { data: result, meta: { page, limit } };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy danh sách item');
    }
  }

  async createItem(dto: CreateErpItemDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)('erp_inventory_items', {
          ...dto,
          item_type: dto.item_type ?? 'COMPONENT',
          tracking_type: dto.tracking_type ?? 'NONE',
          is_active: dto.is_active ?? true,
        }),
      );
      return { message: 'Tạo item thành công', data: result };
    } catch (error: unknown) {
      this.logger.error('createItem error', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể tạo item');
    }
  }

  async getItem(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (readItem as any)('erp_inventory_items', id),
      );
      if (!result) throw new NotFoundException(`Item ${id} không tồn tại`);
      return result;
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy item');
    }
  }

  async updateItem(id: string, dto: UpdateErpItemDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)('erp_inventory_items', id, dto),
      );
      return { message: 'Cập nhật item thành công', data: result };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể cập nhật item');
    }
  }

  // ─── Purchase Orders ──────────────────────────────────────────────────────────

  async listPos(query: ErpMfgQueryDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const page = query.page ?? 1;
      const limit = query.pageSize ?? 20;
      const result = await (client as any).request(
        (readItems as any)('erp_purchase_orders', {
          filter: this.buildFilter(query),
          limit,
          page,
          sort: [query.sort ?? '-created_at'],
          search: query.search,
          fields: ['*', 'lines.*'],
          meta: 'total_count,filter_count',
        }),
      );
      return { data: result, meta: { page, limit } };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy danh sách PO');
    }
  }

  async createPo(dto: CreateErpPoDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    if (!dto.lines || dto.lines.length === 0)
      throw new BadRequestException('PO phải có ít nhất 1 dòng hàng');

    try {
      const po = await (client as any).request(
        (createItem as any)('erp_purchase_orders', {
          po_no: dto.po_no ?? this.generateNo('PO'),
          branch_id: dto.branch_id,
          supplier_id: dto.supplier_id,
          document_date: dto.document_date ?? new Date().toISOString(),
          expected_receipt_date: dto.expected_receipt_date,
          status: 'DRAFT',
          notes: dto.notes,
        }),
      );

      // Tạo lines
      const lines = await Promise.all(
        dto.lines.map((line) =>
          (client as any).request(
            (createItem as any)('erp_purchase_order_lines', {
              purchase_order_id: po.id,
              inventory_item_id: line.inventory_item_id,
              ordered_qty: line.ordered_qty,
              received_qty: 0,
              unit_price: line.unit_price ?? 0,
              notes: line.notes,
            }),
          ),
        ),
      );

      return { message: 'Tạo PO thành công', data: { ...po, lines } };
    } catch (error: unknown) {
      this.logger.error('createPo error', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể tạo PO');
    }
  }

  async getPo(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (readItem as any)('erp_purchase_orders', id, {
          fields: ['*', 'lines.*', 'lines.inventory_item_id.*'],
        }),
      );
      if (!result) throw new NotFoundException(`PO ${id} không tồn tại`);
      return result;
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy PO');
    }
  }

  async updatePo(id: string, dto: UpdateErpPoDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const po = await (client as any).request(
        (readItem as any)('erp_purchase_orders', id),
      );
      if (!po) throw new NotFoundException(`PO ${id} không tồn tại`);
      if (po.status !== 'DRAFT')
        throw new BadRequestException(
          'Chỉ PO ở trạng thái DRAFT mới được cập nhật',
        );

      const { lines, ...header } = dto;
      const updated = await (client as any).request(
        (updateItem as any)('erp_purchase_orders', id, header),
      );
      return { message: 'Cập nhật PO thành công', data: updated };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể cập nhật PO');
    }
  }

  async confirmPo(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const po = await (client as any).request(
        (readItem as any)('erp_purchase_orders', id),
      );
      if (!po) throw new NotFoundException(`PO ${id} không tồn tại`);
      if (po.status !== 'DRAFT')
        throw new BadRequestException('Chỉ PO DRAFT mới được xác nhận');

      const result = await (client as any).request(
        (updateItem as any)('erp_purchase_orders', id, { status: 'CONFIRMED' }),
      );
      return { message: 'Xác nhận PO thành công', data: result };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể xác nhận PO');
    }
  }

  async cancelPo(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const po = await (client as any).request(
        (readItem as any)('erp_purchase_orders', id),
      );
      if (!po) throw new NotFoundException(`PO ${id} không tồn tại`);
      if (po.status === 'FULLY_RECEIVED')
        throw new BadRequestException('PO đã nhập đủ, không thể hủy');
      if (po.status === 'CANCELLED')
        throw new BadRequestException('PO đã bị hủy rồi');

      const result = await (client as any).request(
        (updateItem as any)('erp_purchase_orders', id, {
          status: 'CANCELLED',
        }),
      );
      return { message: 'Hủy PO thành công', data: result };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể hủy PO');
    }
  }

  // ─── PO Excel Template Download ───────────────────────────────────────────────

  generatePoTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const wsData = [PO_TEMPLATE_HEADERS, ...PO_TEMPLATE_EXAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = PO_TEMPLATE_HEADERS.map((h) => ({
      wch: Math.max(h.length + 4, 18),
    }));

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, 'PO_Import');

    // Info sheet
    const infoData = [
      ['Hướng dẫn nhập file PO'],
      [''],
      ['Cột', 'Bắt buộc', 'Mô tả'],
      ['supplier_code', 'Có', 'Mã nhà cung cấp (erp_business_partners.code)'],
      ['branch_code', 'Không', 'Mã chi nhánh (erp_branches.code)'],
      [
        'document_date',
        'Không',
        'Ngày chứng từ (YYYY-MM-DD), mặc định hôm nay',
      ],
      ['expected_receipt_date', 'Không', 'Ngày dự kiến nhận hàng (YYYY-MM-DD)'],
      ['notes', 'Không', 'Ghi chú header PO'],
      ['item_code', 'Có', 'Mã linh kiện (erp_inventory_items.item_code)'],
      ['ordered_qty', 'Có', 'Số lượng đặt mua (số dương)'],
      ['unit_price', 'Không', 'Đơn giá (số >= 0), mặc định 0'],
      ['line_notes', 'Không', 'Ghi chú dòng hàng'],
      [''],
      ['Lưu ý:'],
      [
        '- Mỗi dòng = 1 dòng hàng. Nếu 1 PO có nhiều dòng, lặp lại supplier_code/branch_code/document_date',
      ],
      ['- Các PO có cùng supplier_code + document_date sẽ được gộp thành 1 PO'],
      ['- Nếu item_code không tìm thấy, dòng đó sẽ báo lỗi'],
      ['- File lỗi: toàn bộ file sẽ không được nhập (atomic)'],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
    wsInfo['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Hướng dẫn');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ─── PO Excel Import (atomic) ─────────────────────────────────────────────────

  async importPoFromExcel(
    fileBuffer: Buffer,
    userToken: string,
  ): Promise<{
    total_rows: number;
    success_pos: number;
    failed_rows: number;
    errors: { row: number; field: string; message: string }[];
    created_pos: { po_no: string; id: string; line_count: number }[];
  }> {
    this.guard(userToken);

    // ── 1. Parse file ────────────────────────────────────────────────────────
    let rows: Record<string, unknown>[];
    try {
      const wb = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName)
        throw new BadRequestException('File Excel không có sheet nào');
      const ws = wb.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<
        string,
        unknown
      >[];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Không thể đọc file Excel: ${msg}`);
    }

    if (rows.length === 0)
      throw new BadRequestException(
        'File Excel không có dữ liệu (bỏ qua hàng header)',
      );

    // ── 2. Validate headers ──────────────────────────────────────────────────
    const requiredCols = ['item_code', 'ordered_qty', 'supplier_code'];
    const firstRow = rows[0];
    const missingCols = requiredCols.filter((c) => !(c in firstRow));
    if (missingCols.length > 0)
      throw new BadRequestException(
        `File thiếu cột bắt buộc: ${missingCols.join(', ')}. Vui lòng dùng template mẫu.`,
      );

    // ── 3. Lookup tables: supplier code -> id, branch code -> id, item_code -> id ──
    const client = this.getClient(userToken);

    const [suppliersRaw, branchesRaw, itemsRaw] = await Promise.all([
      (client as any).request(
        (readItems as any)('erp_business_partners', {
          filter: { is_active: { _eq: true } },
          fields: ['id', 'code'],
          limit: 2000,
        }),
      ),
      (client as any).request(
        (readItems as any)('erp_branches', {
          filter: { is_active: { _eq: true } },
          fields: ['id', 'code'],
          limit: 500,
        }),
      ),
      (client as any).request(
        (readItems as any)('erp_inventory_items', {
          filter: { is_active: { _eq: true } },
          fields: ['id', 'item_code'],
          limit: 5000,
        }),
      ),
    ]);

    const supplierMap = new Map<string, string>(
      (suppliersRaw as { id: string; code: string }[]).map((s) => [
        s.code,
        s.id,
      ]),
    );
    const branchMap = new Map<string, string>(
      (branchesRaw as { id: string; code: string }[]).map((b) => [
        b.code,
        b.id,
      ]),
    );
    const itemMap = new Map<string, string>(
      (itemsRaw as { id: string; item_code: string }[]).map((i) => [
        i.item_code,
        i.id,
      ]),
    );

    // ── 4. Row-level validation ──────────────────────────────────────────────
    const errors: { row: number; field: string; message: string }[] = [];

    type ParsedRow = {
      rowNum: number;
      supplier_id: string;
      branch_id: string | null;
      document_date: string;
      expected_receipt_date: string | null;
      notes: string;
      item_id: string;
      item_code: string;
      ordered_qty: number;
      unit_price: number;
      line_notes: string;
    };
    const validRows: ParsedRow[] = [];

    const normalizeCell = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value).trim();
      }
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return '';
    };

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // excel row number (1=header, 2=first data)
      const rowErrors: { row: number; field: string; message: string }[] = [];

      const supplier_code = normalizeCell(row['supplier_code']);
      const branch_code = normalizeCell(row['branch_code']);
      const item_code = normalizeCell(row['item_code']);
      const ordered_qty_raw = normalizeCell(row['ordered_qty']);
      const unit_price_raw = normalizeCell(row['unit_price'] ?? '0');
      const document_date_raw = normalizeCell(row['document_date']);
      const expected_date_raw = normalizeCell(row['expected_receipt_date']);
      const notes = normalizeCell(row['notes']);
      const line_notes = normalizeCell(row['line_notes']);

      // supplier_code
      if (!supplier_code) {
        rowErrors.push({
          row: rowNum,
          field: 'supplier_code',
          message: 'Thiếu mã nhà cung cấp (supplier_code)',
        });
      } else if (!supplierMap.has(supplier_code)) {
        rowErrors.push({
          row: rowNum,
          field: 'supplier_code',
          message: `Không tìm thấy nhà cung cấp có code "${supplier_code}"`,
        });
      }

      // item_code
      if (!item_code) {
        rowErrors.push({
          row: rowNum,
          field: 'item_code',
          message: 'Thiếu mã linh kiện (item_code)',
        });
      } else if (!itemMap.has(item_code)) {
        rowErrors.push({
          row: rowNum,
          field: 'item_code',
          message: `Không tìm thấy mã linh kiện "${item_code}"`,
        });
      }

      // ordered_qty
      const ordered_qty = Number(ordered_qty_raw);
      if (!ordered_qty_raw || ordered_qty_raw === '') {
        rowErrors.push({
          row: rowNum,
          field: 'ordered_qty',
          message: 'Thiếu số lượng đặt mua (ordered_qty)',
        });
      } else if (isNaN(ordered_qty) || ordered_qty <= 0) {
        rowErrors.push({
          row: rowNum,
          field: 'ordered_qty',
          message: `Số lượng đặt mua phải là số dương, nhận được "${ordered_qty_raw}"`,
        });
      }

      // unit_price
      const unit_price = unit_price_raw ? Number(unit_price_raw) : 0;
      if (unit_price_raw && (isNaN(unit_price) || unit_price < 0)) {
        rowErrors.push({
          row: rowNum,
          field: 'unit_price',
          message: `Đơn giá phải >= 0, nhận được "${unit_price_raw}"`,
        });
      }

      // document_date (optional, default today)
      let document_date = new Date().toISOString().split('T')[0];
      if (document_date_raw) {
        const d = new Date(document_date_raw);
        if (isNaN(d.getTime())) {
          rowErrors.push({
            row: rowNum,
            field: 'document_date',
            message: `Ngày chứng từ không hợp lệ: "${document_date_raw}" (cần YYYY-MM-DD)`,
          });
        } else {
          document_date = d.toISOString().split('T')[0];
        }
      }

      // expected_receipt_date (optional)
      let expected_receipt_date: string | null = null;
      if (expected_date_raw) {
        const d = new Date(expected_date_raw);
        if (isNaN(d.getTime())) {
          rowErrors.push({
            row: rowNum,
            field: 'expected_receipt_date',
            message: `Ngày dự kiến nhận không hợp lệ: "${expected_date_raw}" (cần YYYY-MM-DD)`,
          });
        } else {
          expected_receipt_date = d.toISOString().split('T')[0];
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        return;
      }

      const supplier_id = supplierMap.get(supplier_code)!;
      const branch_id =
        branch_code && branchMap.has(branch_code)
          ? (branchMap.get(branch_code) ?? null)
          : null;
      const item_id = itemMap.get(item_code)!;

      validRows.push({
        rowNum,
        supplier_id,
        branch_id,
        document_date,
        expected_receipt_date,
        notes,
        item_id,
        item_code,
        ordered_qty,
        unit_price: isNaN(unit_price) ? 0 : unit_price,
        line_notes,
      });
    });

    // ── 5. Atomic: nếu có lỗi thì không tạo gì cả ───────────────────────────
    if (errors.length > 0) {
      return {
        total_rows: rows.length,
        success_pos: 0,
        failed_rows: errors.length,
        errors,
        created_pos: [],
      };
    }

    // ── 6. Group rows by supplier + branch + document_date → 1 PO ───────────
    type PoGroup = {
      supplier_id: string;
      branch_id: string | null;
      document_date: string;
      expected_receipt_date: string | null;
      notes: string;
      lines: ParsedRow[];
    };

    const poMap = new Map<string, PoGroup>();
    for (const row of validRows) {
      const key = `${row.supplier_id}|${row.branch_id ?? ''}|${row.document_date}`;
      if (!poMap.has(key)) {
        poMap.set(key, {
          supplier_id: row.supplier_id,
          branch_id: row.branch_id,
          document_date: row.document_date,
          expected_receipt_date: row.expected_receipt_date,
          notes: row.notes,
          lines: [],
        });
      }
      poMap.get(key)!.lines.push(row);
    }

    // ── 7. Create POs + lines in Directus ────────────────────────────────────
    const created_pos: { po_no: string; id: string; line_count: number }[] = [];
    const createErrors: { row: number; field: string; message: string }[] = [];

    for (const group of poMap.values()) {
      try {
        const po_no = this.generateNo('PO');
        const po = await (client as any).request(
          (createItem as any)('erp_purchase_orders', {
            po_no,
            supplier_id: group.supplier_id,
            branch_id: group.branch_id,
            document_date: group.document_date,
            expected_receipt_date: group.expected_receipt_date,
            status: 'DRAFT',
            notes: group.notes,
          }),
        );

        await Promise.all(
          group.lines.map((line) =>
            (client as any).request(
              (createItem as any)('erp_purchase_order_lines', {
                purchase_order_id: po.id,
                inventory_item_id: line.item_id,
                ordered_qty: line.ordered_qty,
                received_qty: 0,
                unit_price: line.unit_price,
                notes: line.line_notes,
              }),
            ),
          ),
        );

        created_pos.push({
          po_no: po_no,
          id: po.id as string,
          line_count: group.lines.length,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Map về rows của group để report
        group.lines.forEach((line) => {
          createErrors.push({
            row: line.rowNum,
            field: 'general',
            message: `Lỗi khi tạo PO nhóm ngày ${group.document_date}: ${msg}`,
          });
        });
      }
    }

    return {
      total_rows: rows.length,
      success_pos: created_pos.length,
      failed_rows: createErrors.length,
      errors: createErrors,
      created_pos,
    };
  }

  // ─── Receipts (nhập kho nhiều lần) ────────────────────────────────────────────

  async listReceipts(poId: string, query: ErpMfgQueryDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (readItems as any)('erp_inventory_receipts', {
          filter: { purchase_order_id: { _eq: poId } },
          sort: ['-receipt_date'],
          fields: ['*', 'lines.*'],
          limit: query.pageSize ?? 50,
        }),
      );
      return { data: result };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy danh sách receipt');
    }
  }

  async createReceipt(
    poId: string,
    dto: CreateErpReceiptDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    if (!dto.lines || dto.lines.length === 0)
      throw new BadRequestException('Receipt phải có ít nhất 1 dòng');

    // Validate PO status
    const po = await (client as any).request(
      (readItem as any)('erp_purchase_orders', poId, {
        fields: ['*', 'lines.*'],
      }),
    );
    if (!po) throw new NotFoundException(`PO ${poId} không tồn tại`);
    if (po.status === 'CANCELLED')
      throw new BadRequestException('PO đã bị hủy, không thể nhập kho');
    if (po.status === 'FULLY_RECEIVED')
      throw new BadRequestException('PO đã nhập đủ hàng');
    if (po.status === 'DRAFT')
      throw new BadRequestException('PO cần được CONFIRMED trước khi nhập kho');

    // Validate từng dòng: không vượt ordered_qty còn lại
    for (const line of dto.lines) {
      const poLine = (po.lines as any[]).find(
        (l: any) => l.id === line.purchase_order_line_id,
      );
      if (!poLine)
        throw new BadRequestException(
          `Dòng PO "${line.purchase_order_line_id}" không thuộc PO này`,
        );

      const remaining = poLine.ordered_qty - (poLine.received_qty ?? 0);
      if (line.received_qty > remaining)
        throw new BadRequestException(
          `Dòng item "${line.inventory_item_id}": nhập ${line.received_qty} vượt số còn lại ${remaining}`,
        );

      // Validate SERIAL: số serial phải đúng received_qty
      if (line.tracking_type === 'SERIAL') {
        if (!line.serial_nos || line.serial_nos.length !== line.received_qty)
          throw new BadRequestException(
            `Tracking SERIAL: phải cung cấp đúng ${line.received_qty} mã serial`,
          );
      }
      // Validate LOT: cần lot_code
      if (line.tracking_type === 'LOT' && !line.lot_code)
        throw new BadRequestException(
          `Tracking LOT: phải cung cấp lot_code cho dòng item "${line.inventory_item_id}"`,
        );
    }

    try {
      const receipt = await (client as any).request(
        (createItem as any)('erp_inventory_receipts', {
          receipt_no: dto.receipt_no ?? this.generateNo('REC'),
          purchase_order_id: poId,
          branch_id: po.branch_id,
          receipt_date: dto.receipt_date ?? new Date().toISOString(),
          status: 'DRAFT',
          notes: dto.notes,
        }),
      );

      // Create lines + lots/serials + txn
      for (const line of dto.lines) {
        const recLine = await (client as any).request(
          (createItem as any)('erp_inventory_receipt_lines', {
            receipt_id: receipt.id,
            purchase_order_line_id: line.purchase_order_line_id,
            inventory_item_id: line.inventory_item_id,
            tracking_type: line.tracking_type,
            received_qty: line.received_qty,
            unit_cost: line.unit_cost ?? 0,
            lot_code: line.lot_code,
            notes: line.notes,
          }),
        );

        // LOT: tạo/cập nhật erp_inventory_lots
        if (line.tracking_type === 'LOT' && line.lot_code) {
          const existingLots = await (client as any).request(
            (readItems as any)('erp_inventory_lots', {
              filter: {
                inventory_item_id: { _eq: line.inventory_item_id },
                lot_code: { _eq: line.lot_code },
                branch_id: { _eq: po.branch_id },
              },
              limit: 1,
            }),
          );
          if (existingLots.length > 0) {
            const lot = existingLots[0] as any;
            await (client as any).request(
              (updateItem as any)('erp_inventory_lots', lot.id, {
                received_qty: (lot.received_qty ?? 0) + line.received_qty,
                on_hand_qty: (lot.on_hand_qty ?? 0) + line.received_qty,
              }),
            );
          } else {
            await (client as any).request(
              (createItem as any)('erp_inventory_lots', {
                inventory_item_id: line.inventory_item_id,
                branch_id: po.branch_id,
                lot_code: line.lot_code,
                received_qty: line.received_qty,
                issued_qty: 0,
                on_hand_qty: line.received_qty,
              }),
            );
          }
        }

        // SERIAL: tạo erp_inventory_serials
        if (line.tracking_type === 'SERIAL' && line.serial_nos) {
          for (const sn of line.serial_nos) {
            await (client as any).request(
              (createItem as any)('erp_inventory_serials', {
                inventory_item_id: line.inventory_item_id,
                branch_id: po.branch_id,
                serial_no: sn,
                receipt_line_id: recLine.id,
                status: 'IN_STOCK',
              }),
            );
          }
        }

        // Ledger txn
        await (client as any).request(
          (createItem as any)('erp_inventory_txns', {
            inventory_item_id: line.inventory_item_id,
            branch_id: po.branch_id,
            txn_type: 'RECEIPT',
            qty: line.received_qty,
            unit_cost: line.unit_cost ?? 0,
            reference_collection: 'erp_inventory_receipts',
            reference_id: receipt.id,
            lot_code: line.lot_code,
            txn_date: dto.receipt_date ?? new Date().toISOString(),
          }),
        );

        // Cập nhật received_qty trên PO line
        const poLine = (po.lines as any[]).find(
          (l: any) => l.id === line.purchase_order_line_id,
        );
        const newReceivedQty = (poLine.received_qty ?? 0) + line.received_qty;
        await (client as any).request(
          (updateItem as any)(
            'erp_purchase_order_lines',
            line.purchase_order_line_id,
            { received_qty: newReceivedQty },
          ),
        );
      }

      // Cập nhật PO status: PARTIAL_RECEIVED or FULLY_RECEIVED
      const updatedPo = await (client as any).request(
        (readItem as any)('erp_purchase_orders', poId, {
          fields: ['*', 'lines.*'],
        }),
      );
      const allFull = (updatedPo.lines as any[]).every(
        (l: any) => l.received_qty >= l.ordered_qty,
      );
      await (client as any).request(
        (updateItem as any)('erp_purchase_orders', poId, {
          status: allFull ? 'FULLY_RECEIVED' : 'PARTIAL_RECEIVED',
        }),
      );

      // Post receipt
      await (client as any).request(
        (updateItem as any)('erp_inventory_receipts', receipt.id, {
          status: 'POSTED',
        }),
      );

      return {
        message: 'Nhập kho thành công',
        data: {
          receipt_id: receipt.id,
          po_status: allFull ? 'FULLY_RECEIVED' : 'PARTIAL_RECEIVED',
        },
      };
    } catch (error: unknown) {
      this.logger.error('createReceipt error', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể nhập kho');
    }
  }

  // ─── Vehicles / VIN ──────────────────────────────────────────────────────────

  async listVehicles(query: ErpMfgQueryDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const page = query.page ?? 1;
      const limit = query.pageSize ?? 20;
      const result = await (client as any).request(
        (readItems as any)('erp_vehicle_vins', {
          filter: this.buildFilter(query),
          limit,
          page,
          sort: [query.sort ?? '-created_at'],
          search: query.search,
          meta: 'total_count,filter_count',
        }),
      );
      return { data: result, meta: { page, limit } };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy danh sách xe');
    }
  }

  async createVehicle(dto: CreateErpVehicleDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)('erp_vehicle_vins', {
          ...dto,
          status: 'IN_ASSEMBLY',
          assembly_date: dto.assembly_date ?? new Date().toISOString(),
        }),
      );
      return { message: 'Tạo xe thành công', data: result };
    } catch (error: unknown) {
      this.logger.error('createVehicle error', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể tạo xe (VIN có thể trùng)',
      );
    }
  }

  async getVehicle(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (readItem as any)('erp_vehicle_vins', id, {
          fields: ['*'],
        }),
      );
      if (!result) throw new NotFoundException(`Xe ${id} không tồn tại`);
      return result;
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy thông tin xe');
    }
  }

  async updateVehicle(id: string, dto: UpdateErpVehicleDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)('erp_vehicle_vins', id, dto),
      );
      return { message: 'Cập nhật xe thành công', data: result };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể cập nhật xe');
    }
  }

  // ─── Issues (xuất kho gắn VIN) ───────────────────────────────────────────────

  async listIssues(vehicleId: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (readItems as any)('erp_inventory_issues', {
          filter: { vehicle_vin_id: { _eq: vehicleId } },
          sort: ['-issue_date'],
          fields: ['*', 'lines.*'],
        }),
      );
      return { data: result };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy danh sách issue');
    }
  }

  async createIssue(
    vehicleId: string,
    dto: CreateErpIssueDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    if (!dto.lines || dto.lines.length === 0)
      throw new BadRequestException('Issue phải có ít nhất 1 dòng');

    const vehicle = await (client as any).request(
      (readItem as any)('erp_vehicle_vins', vehicleId),
    );
    if (!vehicle) throw new NotFoundException(`Xe ${vehicleId} không tồn tại`);
    if (!['IN_ASSEMBLY', 'ASSEMBLED'].includes(vehicle.status))
      throw new BadRequestException(
        'Chỉ xe đang lắp ráp hoặc đã lắp mới được xuất kho linh kiện',
      );

    // Validate LOT on_hand
    for (const line of dto.lines) {
      if (line.tracking_type === 'LOT' && line.lot_code) {
        const lots = await (client as any).request(
          (readItems as any)('erp_inventory_lots', {
            filter: {
              inventory_item_id: { _eq: line.inventory_item_id },
              lot_code: { _eq: line.lot_code },
            },
            limit: 1,
          }),
        );
        const lot = lots[0] as any;
        if (!lot || lot.on_hand_qty < line.issued_qty)
          throw new BadRequestException(
            `LOT "${line.lot_code}": tồn kho không đủ (có ${lot?.on_hand_qty ?? 0}, cần ${line.issued_qty})`,
          );
      }
      // SERIAL: kiểm tra status IN_STOCK
      if (line.tracking_type === 'SERIAL' && line.serial_nos) {
        for (const sn of line.serial_nos) {
          const serials = await (client as any).request(
            (readItems as any)('erp_inventory_serials', {
              filter: {
                inventory_item_id: { _eq: line.inventory_item_id },
                serial_no: { _eq: sn },
                status: { _eq: 'IN_STOCK' },
              },
              limit: 1,
            }),
          );
          if (serials.length === 0)
            throw new BadRequestException(
              `Serial "${sn}" không ở trạng thái IN_STOCK hoặc không tồn tại`,
            );
        }
      }
    }

    try {
      const issue = await (client as any).request(
        (createItem as any)('erp_inventory_issues', {
          issue_no: dto.issue_no ?? this.generateNo('ISS'),
          vehicle_vin_id: vehicleId,
          branch_id: vehicle.branch_id,
          issue_date: dto.issue_date ?? new Date().toISOString(),
          status: 'DRAFT',
          notes: dto.notes,
        }),
      );

      for (const line of dto.lines) {
        await (client as any).request(
          (createItem as any)('erp_inventory_issue_lines', {
            issue_id: issue.id,
            inventory_item_id: line.inventory_item_id,
            tracking_type: line.tracking_type,
            issued_qty: line.issued_qty,
            unit_cost: line.unit_cost ?? 0,
            lot_code: line.lot_code,
            notes: line.notes,
          }),
        );

        // Update LOT on_hand
        if (line.tracking_type === 'LOT' && line.lot_code) {
          const lots = await (client as any).request(
            (readItems as any)('erp_inventory_lots', {
              filter: {
                inventory_item_id: { _eq: line.inventory_item_id },
                lot_code: { _eq: line.lot_code },
              },
              limit: 1,
            }),
          );
          const lot = lots[0] as any;
          await (client as any).request(
            (updateItem as any)('erp_inventory_lots', lot.id, {
              issued_qty: (lot.issued_qty ?? 0) + line.issued_qty,
              on_hand_qty: (lot.on_hand_qty ?? 0) - line.issued_qty,
            }),
          );
        }

        // Update SERIAL status
        if (line.tracking_type === 'SERIAL' && line.serial_nos) {
          for (const sn of line.serial_nos) {
            const serials = await (client as any).request(
              (readItems as any)('erp_inventory_serials', {
                filter: {
                  inventory_item_id: { _eq: line.inventory_item_id },
                  serial_no: { _eq: sn },
                },
                limit: 1,
              }),
            );
            const serial = serials[0] as any;
            await (client as any).request(
              (updateItem as any)('erp_inventory_serials', serial.id, {
                status: 'ISSUED_TO_VEHICLE',
                vehicle_vin_id: vehicleId,
              }),
            );
          }
        }

        // Ledger txn
        await (client as any).request(
          (createItem as any)('erp_inventory_txns', {
            inventory_item_id: line.inventory_item_id,
            branch_id: vehicle.branch_id,
            txn_type: 'ISSUE',
            qty: -line.issued_qty,
            unit_cost: line.unit_cost ?? 0,
            reference_collection: 'erp_inventory_issues',
            reference_id: issue.id,
            lot_code: line.lot_code,
            txn_date: dto.issue_date ?? new Date().toISOString(),
          }),
        );
      }

      // Post issue
      await (client as any).request(
        (updateItem as any)('erp_inventory_issues', issue.id, {
          status: 'POSTED',
        }),
      );

      return { message: 'Xuất kho thành công', data: { issue_id: issue.id } };
    } catch (error: unknown) {
      this.logger.error('createIssue error', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể xuất kho');
    }
  }

  // ─── Warranties ───────────────────────────────────────────────────────────────

  async listWarranties(vehicleId: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (readItems as any)('erp_vehicle_warranties', {
          filter: { vehicle_vin_id: { _eq: vehicleId } },
          sort: ['-start_date'],
        }),
      );
      return { data: result };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách bảo hành',
      );
    }
  }

  async activateWarranty(
    vehicleId: string,
    dto: ActivateErpWarrantyDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const client = this.getClient(userToken);

    const vehicle = await (client as any).request(
      (readItem as any)('erp_vehicle_vins', vehicleId),
    );
    if (!vehicle) throw new NotFoundException(`Xe ${vehicleId} không tồn tại`);

    // Không kích hoạt 2 bảo hành ACTIVE cùng lúc
    const activeWarranties = await (client as any).request(
      (readItems as any)('erp_vehicle_warranties', {
        filter: {
          vehicle_vin_id: { _eq: vehicleId },
          status: { _eq: 'ACTIVE' },
        },
        limit: 1,
      }),
    );
    if ((activeWarranties as unknown[]).length > 0)
      throw new BadRequestException('Xe này đã có bảo hành ACTIVE');

    try {
      const warranty = await (client as any).request(
        (createItem as any)('erp_vehicle_warranties', {
          warranty_code: dto.warranty_code ?? this.generateNo('WRN'),
          vehicle_vin_id: vehicleId,
          start_date: dto.start_date,
          end_date: dto.end_date,
          status: 'ACTIVE',
          notes: dto.notes,
        }),
      );

      // Update vehicle status
      await (client as any).request(
        (updateItem as any)('erp_vehicle_vins', vehicleId, {
          status: 'WARRANTY_ACTIVE',
        }),
      );

      return { message: 'Kích hoạt bảo hành thành công', data: warranty };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể kích hoạt bảo hành');
    }
  }

  // ─── Stock summary per item ───────────────────────────────────────────────────

  async getStockSummary(itemId: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const txns = await (client as any).request(
        (readItems as any)('erp_inventory_txns', {
          filter: { inventory_item_id: { _eq: itemId } },
          limit: -1,
        }),
      );
      const on_hand = (txns as any[]).reduce(
        (sum: number, t: any) => sum + Number(t.qty ?? 0),
        0,
      );
      return {
        inventory_item_id: itemId,
        on_hand_qty: on_hand,
        txn_count: (txns as any[]).length,
      };
    } catch (error: unknown) {
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể tính tồn kho');
    }
  }
}

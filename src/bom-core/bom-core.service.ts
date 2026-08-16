import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PassThrough } from 'stream';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpBom } from './entities/erp_bom.entity';
import { ErpBomLine } from './entities/erp_bom_line.entity';
import { ErpBomAttributeValue } from '../bom-config/entities/erp_bom_attribute_value.entity';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { ListBomDto } from './dto/list-bom.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class BomCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpBom)
    private readonly repository: Repository<ErpBom>,
    @InjectRepository(ErpBomLine)
    private readonly lineRepository: Repository<ErpBomLine>,
  ) {}

  async create(dto: CreateBomDto) {
    const { lines = [], attributes, ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpBom);
      const lineRepo = manager.getRepository(ErpBomLine);
      const data = await headerRepo.save(
        headerRepo.create({
          status: header.status ?? 'ACTIVE',
          ...header,
        } as DeepPartial<ErpBom>),
      );
      const savedLines: ErpBomLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        let uomId = line.uomId;
        if (!uomId && line.componentItemId) {
          const items = await manager.query(
            'SELECT uom_id FROM erp_inventory_items WHERE id = $1',
            [line.componentItemId],
          );
          if (items.length > 0) uomId = items[0].uom_id;
        }

        savedLines.push(
          await lineRepo.save(
            lineRepo.create({
              bomId: data.id,
              lineNo: lineNo++,
              componentItemId: line.componentItemId ?? null,
              qtyRequired: line.qtyRequired,
              uomId: uomId ?? null,
              scrapRate: line.scrapRate ?? null,
              notes: line.notes ?? null,
            } as DeepPartial<ErpBomLine>),
          ),
        );
      }

      if (attributes && typeof attributes === 'object') {
        const attrValRepo = manager.getRepository(ErpBomAttributeValue);
        const attrMap = attributes as Record<string, string | number | boolean>;
        for (const [attrDefId, rawVal] of Object.entries(attrMap)) {
          if (rawVal !== undefined && rawVal !== null) {
            const valStr =
              typeof rawVal === 'string' ? rawVal.trim() : `${rawVal}`.trim();
            if (valStr !== '') {
              await attrValRepo.save(
                attrValRepo.create({
                  bomId: data.id,
                  attrDefId,
                  valueText: valStr,
                }),
              );
            }
          }
        }
      }

      return {
        message: 'Tạo thành công',
        data: { ...data, lines: savedLines, attributes: attributes || {} },
      };
    });
  }

  async findAll(query: ListBomDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      defaultOrder: { createdAt: 'DESC' },
    });

    const where: any = { isDeleted: false };
    if (query.search) {
      where.bomName = ILike(`%${query.search}%`);
    }
    if (query.finishedGoodItemId) {
      where.finishedGoodItemId = query.finishedGoodItemId;
    }

    const [items, total] = await this.repository.findAndCount({
      where: Object.keys(where).length > 0 ? where : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });

    if (items.length > 0) {
      const fgIds = items.map((i) => i.finishedGoodItemId).filter(Boolean);
      if (fgIds.length > 0) {
        const fgItems = await this.dataSource.query(
          `SELECT id, sku, item_name FROM public.erp_inventory_items WHERE id = ANY($1::uuid[])`,
          [fgIds],
        );
        const fgMap = new Map(fgItems.map((i: any) => [i.id, i]));
        for (const item of items) {
          if (item.finishedGoodItemId && fgMap.has(item.finishedGoodItemId)) {
            const fg = fgMap.get(item.finishedGoodItemId) as any;
            (item as any).finishedGoodItemCode = fg.sku;
            (item as any).finishedGoodItemName = `${fg.sku} — ${fg.item_name}`;
          }
        }
      }
    }

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOneOrFail({
      where: { id, isDeleted: false },
      relations: {
        category: true,
        attributeValues: true,
      },
    });
    const lines = await this.lineRepository.find({
      where: { bomId: id },
      relations: ['uom'],
      order: { lineNo: 'ASC' },
    });

    lines.forEach((line: any) => {
      line.uom = line.uom?.name || '';
    });

    const attrMap: Record<string, string> = {};
    if (data.attributeValues) {
      data.attributeValues.forEach((val) => {
        attrMap[val.attrDefId] = val.valueText || '';
      });
    }
    (data as any).attributes = attrMap;
    (data as any).categoryCode = data.category?.code || null;
    (data as any).categoryName = data.category?.name || null;

    // Kiểm tra xem BOM này đã phát sinh Lệnh sản xuất chưa
    const prodOrderCount = await this.dataSource.query(
      `SELECT COUNT(1) as count FROM erp_production_orders WHERE is_deleted = false AND (output_metadata->>'bomId' = $1 OR (output_metadata IS NULL AND finished_good_item_id = $2))`,
      [id, data.finishedGoodItemId || '00000000-0000-0000-0000-000000000000'],
    );
    const count = parseInt(prodOrderCount[0]?.count, 10) || 0;
    (data as any).hasProduction = count > 0;
    (data as any).productionCount = count;

    if (data.finishedGoodItemId) {
      const fgItems = await this.dataSource.query(
        `SELECT id, sku, item_name FROM public.erp_inventory_items WHERE id = $1::uuid`,
        [data.finishedGoodItemId],
      );
      if (fgItems.length > 0) {
        const fg = fgItems[0];
        (data as any).finishedGoodItemCode = fg.sku;
        (data as any).finishedGoodItemName = `${fg.sku} — ${fg.item_name}`;
      }
    }

    if (lines.length > 0) {
      const itemIds = lines.map((l) => l.componentItemId).filter(Boolean);
      if (itemIds.length > 0) {
        const items = await this.dataSource.query(
          `SELECT
             i.id,
             i.sku,
             i.item_name,
             p.code AS tracking_policy_code
           FROM public.erp_inventory_items i
           LEFT JOIN public.erp_tracking_policies p ON p.id = i.tracking_policy_id
           WHERE i.id = ANY($1::uuid[])`,
          [itemIds],
        );
        const itemMap = new Map(items.map((i: any) => [i.id, i]));
        for (const line of lines) {
          if (line.componentItemId && itemMap.has(line.componentItemId)) {
            const item = itemMap.get(line.componentItemId) as any;
            (line as any).componentItemCode = item.sku;
            (line as any).componentItemName = `${item.sku} — ${item.item_name}`;
            // Dòng BOM có cần track serial riêng lẻ không?
            // true = cần ghi As-Built BOM khi sản xuất (policy SERIAL hoặc CUSTOM)
            (line as any).requiresSerialTracking = [
              'SERIAL',
              'CUSTOM',
            ].includes(item.tracking_policy_code ?? '');
          }
        }
      }
    }

    return { message: 'Lấy thông tin thành công', data: { ...data, lines } };
  }

  async update(id: string, dto: UpdateBomDto) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy định mức (BOM)');

    // Kiểm tra xem BOM này đã phát sinh Lệnh sản xuất chưa
    const prodOrderCount = await this.dataSource.query(
      `SELECT COUNT(1) as count FROM erp_production_orders WHERE is_deleted = false AND (output_metadata->>'bomId' = $1 OR (output_metadata IS NULL AND finished_good_item_id = $2))`,
      [
        id,
        existing.finishedGoodItemId || '00000000-0000-0000-0000-000000000000',
      ],
    );
    const hasProduction = (parseInt(prodOrderCount[0]?.count, 10) || 0) > 0;

    if (hasProduction) {
      // Nếu BOM đã có sản xuất: Chỉ cho phép sửa ghi chú và hiệu lực đến
      const allowedPatch: Partial<ErpBom> = {};
      if (dto.notes !== undefined) allowedPatch.notes = dto.notes;
      if (dto.effectiveTo !== undefined)
        allowedPatch.effectiveTo = dto.effectiveTo;
      if (Object.keys(allowedPatch).length > 0) {
        await this.repository.update(id, allowedPatch);
      }
      return this.findOne(id);
    }

    const { lines, attributes, ...header } = dto as any;
    await this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpBom);
      if (Object.keys(header).length > 0) {
        await headerRepo.update(id, header);
      }

      if (Array.isArray(lines)) {
        const lineRepo = manager.getRepository(ErpBomLine);
        await lineRepo.delete({ bomId: id });
        let lineNo = 1;
        for (const line of lines) {
          let uomId = line.uomId;
          if (!uomId && line.componentItemId) {
            const items = await manager.query(
              'SELECT uom_id FROM erp_inventory_items WHERE id = $1',
              [line.componentItemId],
            );
            if (items.length > 0) uomId = items[0].uom_id;
          }

          await lineRepo.save(
            lineRepo.create({
              bomId: id,
              lineNo: lineNo++,
              componentItemId: line.componentItemId ?? null,
              qtyRequired: line.qtyRequired,
              uomId: uomId ?? null,
              scrapRate: line.scrapRate ?? null,
              notes: line.notes ?? null,
            } as DeepPartial<ErpBomLine>),
          );
        }
      }

      if (attributes !== undefined) {
        const attrValRepo = manager.getRepository(ErpBomAttributeValue);
        await attrValRepo.delete({ bomId: id });
        if (attributes && typeof attributes === 'object') {
          const attrMap = attributes as Record<
            string,
            string | number | boolean
          >;
          for (const [attrDefId, rawVal] of Object.entries(attrMap)) {
            if (rawVal !== undefined && rawVal !== null) {
              const valStr =
                typeof rawVal === 'string' ? rawVal.trim() : `${rawVal}`.trim();
              if (valStr !== '') {
                await attrValRepo.save(
                  attrValRepo.create({
                    bomId: id,
                    attrDefId,
                    valueText: valStr,
                  }),
                );
              }
            }
          }
        }
      }
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy định mức (BOM)');

    const prodOrderCount = await this.dataSource.query(
      `SELECT COUNT(1) as count FROM erp_production_orders WHERE is_deleted = false AND (output_metadata->>'bomId' = $1 OR (output_metadata IS NULL AND finished_good_item_id = $2))`,
      [
        id,
        existing.finishedGoodItemId || '00000000-0000-0000-0000-000000000000',
      ],
    );
    const hasProduction = (parseInt(prodOrderCount[0]?.count, 10) || 0) > 0;
    if (hasProduction) {
      throw new ConflictException(
        'Định mức (BOM) đã phát sinh lệnh sản xuất, không thể xóa.',
      );
    }

    await this.repository.update(id, { isDeleted: true } as any);
    return { message: 'Xóa thành công' };
  }

  async exportMultiLevelBom(id: string, format: 'xlsx' | 'csv' = 'xlsx') {
    const rootBom = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!rootBom) throw new NotFoundException('Không tìm thấy định mức (BOM)');

    interface FlatNode {
      level: number;
      indexStr: string;
      line: ErpBomLine;
    }

    const results: FlatNode[] = [];
    const visited = new Set<string>();

    const resolveSubBom = async (
      bomId: string,
      level: number,
      parentIndex: string,
    ) => {
      if (visited.has(bomId)) return;
      visited.add(bomId);

      const lines = await this.lineRepository.find({
        where: { bomId },
        relations: ['uom'],
        order: { lineNo: 'ASC' },
      });

      let i = 1;
      for (const line of lines) {
        const currentIndex = parentIndex ? `${parentIndex}.${i}` : `${i}`;
        results.push({
          level,
          indexStr: currentIndex,
          line,
        });

        if (line.componentItemId) {
          const subBom = await this.repository.findOne({
            where: {
              finishedGoodItemId: line.componentItemId,
              status: 'ACTIVE',
              isDeleted: false,
            },
            order: { createdAt: 'DESC' },
          });
          if (subBom) {
            await resolveSubBom(subBom.id, level + 1, currentIndex);
          }
        }
        i++;
      }
    };

    await resolveSubBom(id, 1, '');

    // Fetch items context
    const itemIds = new Set<string>();
    if (rootBom.finishedGoodItemId) itemIds.add(rootBom.finishedGoodItemId);
    results.forEach((r) => {
      if (r.line.componentItemId) itemIds.add(r.line.componentItemId);
    });

    const itemMap = new Map<string, any>();
    if (itemIds.size > 0) {
      const items = await this.dataSource.query(
        `SELECT id, sku, item_name FROM public.erp_inventory_items WHERE id = ANY($1::uuid[])`,
        [Array.from(itemIds)],
      );
      items.forEach((i: any) => itemMap.set(i.id, i));
    }

    const rowsData = results.map((r) => {
      const item = r.line.componentItemId
        ? itemMap.get(r.line.componentItemId)
        : null;
      return {
        stt: r.indexStr,
        tenLinhKien: item ? item.item_name : '',
        maLinhKien: item ? item.sku : '',
        dvt: (r.line.uom as any)?.name || '',
        soLuong: Number(r.line.qtyRequired) || 0,
        haoHut: r.line.scrapRate ? Number(r.line.scrapRate) : 0,
        ghiChu: r.line.notes || '',
      };
    });

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeBomCode = (rootBom.bomCode || 'BOM').replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );

    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (format === 'csv') {
      const csvHeader = [
        'STT',
        'Tên linh kiện',
        'Mã LINH KIỆN',
        'Đơn vị tính',
        'Số lượng',
        'Hao hụt (%)',
        'Ghi chú',
      ];
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('BOM');
      ws.addRow(csvHeader);
      rowsData.forEach((row) => {
        ws.addRow([
          row.stt,
          row.tenLinhKien,
          row.maLinhKien,
          row.dvt,
          row.soLuong,
          row.haoHut,
          row.ghiChu,
        ]);
      });
      const csvBuffer = await wb.csv.writeBuffer();
      // Add BOM to CSV for UTF-8 compatibility
      buffer = Buffer.concat([
        Buffer.from('\uFEFF', 'utf-8'),
        Buffer.from(csvBuffer),
      ]);
      contentType = 'text/csv; charset=utf-8';
      filename = `${safeBomCode}_${timestamp}.csv`;
    } else {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('BOM Details');

      ws.getColumn('A').width = 8;
      ws.getColumn('B').width = 70;
      ws.getColumn('C').width = 40;
      ws.getColumn('D').width = 15;
      ws.getColumn('E').width = 15;
      ws.getColumn('F').width = 15;
      ws.getColumn('G').width = 30;

      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];

      ws.mergeCells('A1:C3');
      const logoCell = ws.getCell('A1');
      logoCell.value = 'K LOTUS';
      logoCell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      logoCell.font = { bold: true, size: 24 };

      ws.mergeCells('D1:E3');
      const titleCell = ws.getCell('D1');
      titleCell.value = 'ĐỊNH MỨC VẬT TƯ';
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.font = { bold: true, size: 16 };

      ws.mergeCells('F1:G1');
      ws.getCell('F1').value = 'Mã số: K LOTUS-SX-BM-01-04';
      ws.mergeCells('F2:G2');
      const dateStr = rootBom.effectiveFrom
        ? new Date(rootBom.effectiveFrom).toLocaleDateString('vi-VN')
        : new Date().toLocaleDateString('vi-VN');
      ws.getCell('F2').value = `Ngày ban hành: ${dateStr}`;
      ws.mergeCells('F3:G3');
      ws.getCell('F3').value = `Lần ban hành: ${rootBom.version || '01'}`;

      ws.mergeCells('A4:C4');
      const parts = new Date().toLocaleDateString('vi-VN').split('/');
      ws.getCell('A4').value =
        `Ngày ${parts[0]} tháng ${parts[1]} năm ${parts[2]}`;
      ws.getCell('A4').alignment = { horizontal: 'center' };
      ws.getCell('A4').font = { italic: true };

      ws.mergeCells('D4:E4');
      ws.getCell('D4').value =
        `Nhãn hiệu/ số loại: K LOTUS/ ${rootBom.bomName}`;
      ws.getCell('D4').alignment = { horizontal: 'center' };
      ws.getCell('D4').font = { italic: true };

      ws.mergeCells('F4:G4');
      ws.getCell('F4').value = `Số: ${rootBom.bomCode}`;
      ws.getCell('F4').alignment = { horizontal: 'center' };
      ws.getCell('F4').font = { italic: true };

      ws.getCell('A5').value = 'STT';
      ws.getCell('B5').value = 'Tên linh kiện';
      ws.getCell('C5').value = 'Mã LINH KIỆN';
      ws.getCell('D5').value = 'Đơn vị tính';
      ws.getCell('E5').value = 'Số lượng';
      ws.getCell('F5').value = 'Hao hụt (%)';
      ws.getCell('G5').value = 'Ghi chú';

      const headerRow = ws.getRow(5);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.autoFilter = 'A5:G5';

      rowsData.forEach((row, index) => {
        const rowIndex = 6 + index;
        ws.getCell(`A${rowIndex}`).value = row.stt;
        ws.getCell(`A${rowIndex}`).alignment = { horizontal: 'center' };
        ws.getCell(`B${rowIndex}`).value = row.tenLinhKien;
        ws.getCell(`C${rowIndex}`).value = row.maLinhKien;
        ws.getCell(`D${rowIndex}`).value = row.dvt;
        ws.getCell(`D${rowIndex}`).alignment = { horizontal: 'center' };
        ws.getCell(`E${rowIndex}`).value = row.soLuong;
        ws.getCell(`E${rowIndex}`).alignment = { horizontal: 'center' };
        ws.getCell(`F${rowIndex}`).value = row.haoHut;
        ws.getCell(`F${rowIndex}`).alignment = { horizontal: 'center' };
        ws.getCell(`G${rowIndex}`).value = row.ghiChu;
      });

      for (let i = 1; i <= 5 + rowsData.length; i++) {
        for (let j = 1; j <= 7; j++) {
          const cell = ws.getCell(i, j);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        }
      }

      buffer = Buffer.from(await wb.xlsx.writeBuffer());
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `${safeBomCode}_${timestamp}.xlsx`;
    }

    return { buffer, contentType, filename };
  }

  async generateImportTemplate() {
    const wb = new ExcelJS.Workbook();

    // Sheet 1: Template
    const ws = wb.addWorksheet('Template');
    ws.columns = [
      { header: 'Mã linh kiện (*)', key: 'sku', width: 20 },
      { header: 'Số lượng (*)', key: 'qty', width: 15 },
      { header: 'Hao hụt %', key: 'scrapRate', width: 15 },
      { header: 'Ghi chú', key: 'notes', width: 30 },
    ];

    // Make header bold
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Some instructions
    ws.addRow(['Vật tư A', 10, 0, 'Ví dụ nhập dòng này']);
    ws.addRow(['Vật tư B', 5, 2, 'Ghi chú thêm ở đây']);

    // Sheet 2: Inventory Items
    const itemsWs = wb.addWorksheet('Danh sách linh kiện');
    itemsWs.columns = [
      { header: 'Mã (SKU)', key: 'sku', width: 20 },
      { header: 'Tên sản phẩm', key: 'name', width: 50 },
      { header: 'Đơn vị tính', key: 'uom', width: 15 },
    ];
    itemsWs.getRow(1).font = { bold: true };
    itemsWs.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    itemsWs.autoFilter = 'A1:C1';

    const items = await this.dataSource.query(
      `SELECT i.sku, i.item_name, u.name as uom FROM public.erp_inventory_items i LEFT JOIN public.erp_uoms u ON i.uom_id = u.id WHERE i.status = 'ACTIVE' ORDER BY i.sku ASC`,
    );

    for (const item of items) {
      itemsWs.addRow([item.sku, item.item_name, item.uom]);
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return {
      buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'BOM_Import_Template.xlsx',
    };
  }

  async parseBomLines(file: any) {
    if (!file) throw new BadRequestException('Vui lòng chọn file');

    const lines: any[] = [];
    const skuSet = new Set<string>();

    try {
      if (file.originalname.endsWith('.csv') || file.mimetype.includes('csv')) {
        // Simple CSV parsing using exceljs CSV reader
        const wb = new ExcelJS.Workbook();
        const bufferStream = new PassThrough();
        bufferStream.end(file.buffer);

        const ws = await wb.csv.read(bufferStream);
        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header
          const sku = row.getCell(1).text?.trim();
          if (!sku) return;
          skuSet.add(sku);
          lines.push({
            sku,
            qtyRequired: Number(row.getCell(2).value) || 0,
            scrapRate: Number(row.getCell(3).value) || 0,
            notes: row.getCell(4).text?.trim() || '',
          });
        });
      } else {
        // XLSX
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(file.buffer);
        const ws = wb.worksheets[0]; // First sheet
        if (!ws) throw new BadRequestException('File không hợp lệ');

        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header
          const sku = row.getCell(1).text?.trim();
          if (!sku) return;
          skuSet.add(sku);
          lines.push({
            sku,
            qtyRequired: Number(row.getCell(2).value) || 0,
            scrapRate: Number(row.getCell(3).value) || 0,
            notes: row.getCell(4).text?.trim() || '',
          });
        });
      }
    } catch (error) {
      throw new BadRequestException('Lỗi đọc file: ' + error.message);
    }

    if (lines.length === 0) {
      throw new BadRequestException('Không tìm thấy dữ liệu dòng nào');
    }

    // Validate items
    const items = await this.dataSource.query(
      `SELECT i.id, i.sku, i.item_name, i.uom_id, u.name as uom FROM public.erp_inventory_items i LEFT JOIN public.erp_uoms u ON i.uom_id = u.id WHERE i.sku = ANY($1)`,
      [Array.from(skuSet)],
    );

    const itemMap = new Map<string, any>();
    items.forEach((i: any) => itemMap.set(i.sku, i));

    const validatedLines = lines.map((line) => {
      const item = itemMap.get(line.sku);
      if (!item) {
        throw new BadRequestException(
          `Linh kiện có mã ${line.sku} không tồn tại hoặc ngưng hoạt động`,
        );
      }
      if (line.qtyRequired <= 0) {
        throw new BadRequestException(
          `Số lượng của linh kiện ${line.sku} phải lớn hơn 0`,
        );
      }
      return {
        componentItemId: item.id,
        componentItemCode: item.sku,
        componentItemName: `${item.sku} — ${item.item_name}`,
        qtyRequired: line.qtyRequired,
        uomId: item.uom_id,
        uom: item.uom || 'PCS',
        scrapRate: line.scrapRate,
        notes: line.notes,
      };
    });

    return { message: 'Parse thành công', data: validatedLines };
  }

  async getColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filtersStr?: string,
  ) {
    const qb = this.repository.createQueryBuilder('bom');
    qb.where('bom.isDeleted = :isDeleted', { isDeleted: false });

    let selectField = '';

    if (column === 'bom_code') selectField = 'bom.bomCode';
    else if (column === 'bom_name') selectField = 'bom.bomName';
    else if (column === 'version') selectField = 'bom.version';
    else if (column === 'status') selectField = 'bom.status';
    else if (column === 'finished_good_item_name') {
      qb.leftJoin(
        'erp_inventory_items',
        'item',
        'item.id = bom.finishedGoodItemId',
      );
      selectField = 'item.itemName';
    } else return { items: [], total: 0 };

    qb.select(`DISTINCT ${selectField}`, 'value');
    qb.andWhere(`${selectField} IS NOT NULL`);
    qb.andWhere(`CAST(${selectField} AS TEXT) != ''`);

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          if (col === 'status')
            qb.andWhere(`bom.status IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'bom_code')
            qb.andWhere(`bom.bomCode IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
        }
      } catch (e) {}
    }

    if (search) {
      qb.andWhere(`CAST(${selectField} AS TEXT) ILIKE :search`, {
        search: `%${search}%`,
      });
    }

    qb.orderBy('value', 'ASC');

    const raw = await qb.getRawMany();
    const total = raw.length;
    const items = raw
      .slice((page - 1) * pageSize, page * pageSize)
      .map((r) => String(r.value));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

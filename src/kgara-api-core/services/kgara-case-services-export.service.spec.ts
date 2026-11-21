import * as ExcelJS from 'exceljs';
import { Logger } from '@nestjs/common';
import { KgaraCaseServicesExportService } from './kgara-case-services-export.service';

const SHEET_NAME = 'Chi tiết DV & Phụ tùng';

function buildQueryBuilder(rows: any[]) {
  const qb: any = {};
  qb.select = jest.fn(() => qb);
  qb.where = jest.fn(() => qb);
  qb.getMany = jest.fn(async () => rows);
  return qb;
}

async function readColumnValues(buffer: Buffer, header: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error('missing sheet');

  let headerRow = 0;
  let col = 0;
  for (let r = 1; r <= 6 && !col; r++) {
    ws.getRow(r).eachCell((cell, colNumber) => {
      if (cell.value === header) {
        headerRow = r;
        col = colNumber;
      }
    });
  }
  if (!col) throw new Error(`missing header ${header}`);

  const values: unknown[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).getCell(col).value;
    if (v !== null && v !== undefined && v !== '') values.push(v);
  }
  return values;
}

const partLine = {
  id: 'line-1',
  soChungTu: 'GR-PDV2609-0050',
  bienSoXe: '51M48579',
  loaiSanPhamCode: 'PT',
  sanPhamCode: 'HH-000052',
  sanPhamName: 'Nhớt động cơ 5W-30',
  noiDungChiTiet: 'Nhớt động cơ 5W-30',
  donViTinhText: 'Lít',
  soLuongHoaDon: 4.7,
  donGia: 294000,
  tienChuaThue: 1381800,
  tienCoThue: 1381800,
  tienPhuTung: 1381800,
  giaVonPhuTung: 0,
  tienChietKhauCt: 0,
};

describe('KgaraCaseServicesExportService – giá vốn từ journal', () => {
  it('làm giàu đơn giá vốn và tổng vốn từ journal đã lưu', async () => {
    const queryService = {
      findCaseServices: jest.fn(async () => ({ data: [{ ...partLine }] })),
    };
    const grossProfitRepo = {
      createQueryBuilder: jest.fn(() =>
        buildQueryBuilder([
          {
            vuViecCode: 'GR-PDV2609-0050',
            rawData: {
              journal_items: [
                {
                  TaiKhoanNoCode: '1541',
                  ChiPhi: 893000,
                  NoiDung: 'Nhớt động cơ 5W-30',
                },
              ],
            },
          },
        ]),
      ),
    };
    const service = new KgaraCaseServicesExportService(
      queryService as any,
      grossProfitRepo as any,
    );

    const buffer = await service.exportCaseServicesExcel({});

    expect(await readColumnValues(buffer, 'Tổng vốn')).toEqual([893000]);
    expect(await readColumnValues(buffer, 'Đơn giá vốn')).toEqual([190000]);
  });

  it('giữ giá vốn = 0 khi phiếu chưa có journal đã lưu', async () => {
    const queryService = {
      findCaseServices: jest.fn(async () => ({ data: [{ ...partLine }] })),
    };
    const grossProfitRepo = {
      createQueryBuilder: jest.fn(() => buildQueryBuilder([])),
    };
    const service = new KgaraCaseServicesExportService(
      queryService as any,
      grossProfitRepo as any,
    );

    const buffer = await service.exportCaseServicesExcel({});

    expect(await readColumnValues(buffer, 'Tổng vốn')).toEqual([0]);
    expect(await readColumnValues(buffer, 'Đơn giá vốn')).toEqual([0]);
  });

  it('không truy vấn journal khi không có repo (bỏ qua làm giàu)', async () => {
    const queryService = {
      findCaseServices: jest.fn(async () => ({ data: [{ ...partLine }] })),
    };
    const service = new KgaraCaseServicesExportService(queryService as any);

    const buffer = await service.exportCaseServicesExcel({});

    expect(await readColumnValues(buffer, 'Tổng vốn')).toEqual([0]);
  });

  it('ghi log warn và vẫn xuất file khi làm giàu giá vốn lỗi (AC-7)', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const queryService = {
      findCaseServices: jest.fn(async () => ({ data: [{ ...partLine }] })),
    };
    const qb = buildQueryBuilder([]);
    qb.getMany = jest.fn(async () => {
      throw new Error('db down');
    });
    const grossProfitRepo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new KgaraCaseServicesExportService(
      queryService as any,
      grossProfitRepo as any,
    );

    const buffer = await service.exportCaseServicesExcel({});

    expect(await readColumnValues(buffer, 'Tổng vốn')).toEqual([0]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
    warn.mockRestore();
  });
});

describe('KgaraCaseServicesExportService – tách sheet công và OJ', () => {
  const mk = (over: Record<string, unknown>) => ({
    ...partLine,
    accountKey: 'MAIN',
    ...over,
  });

  it('tách công theo ĐVT và OJ ra sheet riêng, bảo toàn tổng số dòng', async () => {
    const data = [
      mk({ id: '1', soChungTu: 'GR-1', donViTinhText: 'Lít' }),
      mk({
        id: '2',
        soChungTu: 'GR-1',
        donViTinhText: 'Lần',
        loaiSanPhamCode: 'DV',
      }),
      mk({
        id: '3',
        soChungTu: 'GR-1',
        donViTinhText: 'Công',
        loaiSanPhamCode: 'DV',
      }),
      // phụ tùng nhưng ĐVT là công: theo ĐVT nên sang sheet công
      mk({
        id: '4',
        soChungTu: 'GR-2',
        donViTinhText: 'cõng',
        loaiSanPhamCode: 'PT',
      }),
      mk({
        id: '5',
        soChungTu: 'GN-1',
        accountKey: 'OJ',
        donViTinhText: 'Cái',
      }),
      mk({
        id: '6',
        soChungTu: 'GN-1',
        accountKey: 'OJ',
        donViTinhText: 'công',
        loaiSanPhamCode: 'DV',
      }),
    ];
    const queryService = { findCaseServices: jest.fn(async () => ({ data })) };
    const service = new KgaraCaseServicesExportService(queryService as any);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await service.exportCaseServicesExcel({})) as any);

    const codesOf = (name: string) => {
      const ws = wb.getWorksheet(name)!;
      const out: string[] = [];
      ws.eachRow((r, n) => {
        const v = r.getCell(4).text;
        if (n > 4 && /^G[RN]-/.test(v)) out.push(v);
      });
      return out;
    };
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Chi tiết DV & Phụ tùng',
      'Chi tiết Công',
      'Chi tiết DV & PT (OJ)',
      'Chi tiết Công (OJ)',
    ]);
    expect(codesOf('Chi tiết DV & Phụ tùng')).toEqual(['GR-1', 'GR-1']);
    expect(codesOf('Chi tiết Công')).toEqual(['GR-1', 'GR-2']);
    expect(codesOf('Chi tiết DV & PT (OJ)')).toEqual(['GN-1']);
    expect(codesOf('Chi tiết Công (OJ)')).toEqual(['GN-1']);
    const total = wb.worksheets.reduce((n, w) => n + codesOf(w.name).length, 0);
    expect(total).toBe(data.length);
  });

  it('không có OJ và không có công thì chỉ một sheet', async () => {
    const queryService = {
      findCaseServices: jest.fn(async () => ({ data: [mk({ id: '1' })] })),
    };
    const service = new KgaraCaseServicesExportService(queryService as any);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await service.exportCaseServicesExcel({})) as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Chi tiết DV & Phụ tùng',
    ]);
  });
});

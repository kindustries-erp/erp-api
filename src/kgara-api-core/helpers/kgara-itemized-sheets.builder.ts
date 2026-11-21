import type * as ExcelJS from 'exceljs';
import { isLaborUnit } from './kgara-labor-unit.helper';
import { buildSheet3ItemizedServices } from './kgara-completed-cases-sheet.builder';

/** Tên sheet chi tiết hạng mục theo (tài khoản KGara × công/không công). */
export const ITEMIZED_SHEET_NAMES = {
  main: 'Chi tiết DV & Phụ tùng',
  mainLabor: 'Chi tiết Công',
  oj: 'Chi tiết DV & PT (OJ)',
  ojLabor: 'Chi tiết Công (OJ)',
} as const;

export type ItemizedSheetKey = keyof typeof ITEMIZED_SHEET_NAMES;

const unitOf = (line: any): string =>
  line?.donViTinhText ?? line?.DonViTinhText ?? '';

/** Phiếu OJ khi `accountKey = 'OJ'`; thiếu/MAIN/khác là MAIN. */
export const isOjCase = (caseRow: any): boolean =>
  String(caseRow?.accountKey ?? '').toUpperCase() === 'OJ';

/** Nhóm sheet của một dòng hạng mục: OJ hay MAIN, công (theo ĐVT) hay không. */
export function itemizedSheetKeyOf(caseRow: any, line: any): ItemizedSheetKey {
  const labor = isLaborUnit(unitOf(line));
  if (isOjCase(caseRow)) return labor ? 'ojLabor' : 'oj';
  return labor ? 'mainLabor' : 'main';
}

/**
 * Sheet chi tiết hạng mục của bảng kê: tách công khỏi DV/PT (theo ĐVT) và tách OJ khỏi MAIN.
 * Mỗi dòng thuộc đúng một sheet, mỗi sheet có tổng riêng. Sheet MAIN không công luôn được tạo
 * (giữ tương thích); ba sheet còn lại chỉ tạo khi có dòng.
 */
export function buildItemizedSheets(
  workbook: ExcelJS.Workbook,
  cases: any[],
  serviceLinesMap: Map<string, any[]>,
): void {
  const counts: Record<ItemizedSheetKey, number> = {
    main: 0,
    mainLabor: 0,
    oj: 0,
    ojLabor: 0,
  };
  for (const c of cases) {
    if (!c.hdPhieuDichVuId) continue;
    for (const line of serviceLinesMap.get(c.hdPhieuDichVuId) || []) {
      counts[itemizedSheetKeyOf(c, line)]++;
    }
  }

  (Object.keys(ITEMIZED_SHEET_NAMES) as ItemizedSheetKey[]).forEach((key) => {
    if (key !== 'main' && counts[key] === 0) return;
    buildSheet3ItemizedServices(workbook, cases, serviceLinesMap, {
      sheetName: ITEMIZED_SHEET_NAMES[key],
      includeLine: (c, line) => itemizedSheetKeyOf(c, line) === key,
    });
  });
}

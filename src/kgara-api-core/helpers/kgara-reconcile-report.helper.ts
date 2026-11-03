/** Phiếu trong DB (một tài khoản) */
export interface DbCaseSnapshot {
  soChungTu: string;
  hdPhieuDichVuId: string;
  tienCoThue: number;
  /** HdPhieuDichVuChiTietID của các dòng đang có trong DB */
  lineIds: string[];
  lineSum: number;
}

/** Phiếu lấy từ Kgara live (một tài khoản), đã resolve được UUID */
export interface KgaraCaseSnapshot {
  soChungTu: string;
  hdPhieuDichVuId: string;
  tienCoThue: number;
  /** HdPhieuDichVuChiTietID của các dòng trả về từ Kgara */
  lineIds: string[];
  lineSum: number;
}

export interface CaseLineDiff {
  soChungTu: string;
  hdPhieuDichVuId: string;
  kgLines: number;
  dbLines: number;
  /** Dòng có ở Kgara, thiếu trong DB */
  missingInDb: number;
  /** Dòng có trong DB, Kgara không còn trả về */
  extraInDb: number;
  kgTotal: number;
  dbTotal: number;
}

export interface ReconcileReport {
  kgaraCases: number;
  dbCases: number;
  /** Có trong Kgara, không có trong DB */
  kgaraOnly: KgaraCaseSnapshot[];
  /** Có trong DB, không có trong Kgara (kỳ đang đối chiếu) */
  dbOnly: DbCaseSnapshot[];
  /** Phiếu có cả hai bên nhưng số dòng khác nhau */
  lineMismatchCases: CaseLineDiff[];
  /** Phiếu có cả hai bên nhưng tổng tiền phiếu khác (ngưỡng 1đ) */
  totalMismatchCases: CaseLineDiff[];
  totals: {
    kgaraLines: number;
    dbLines: number;
    missingInDb: number;
    extraInDb: number;
  };
}

const MONEY_EPSILON = 1;

function diffLines(kg: string[], db: string[]) {
  const kgSet = new Set(kg);
  const dbSet = new Set(db);
  let missingInDb = 0;
  for (const id of kgSet) if (!dbSet.has(id)) missingInDb++;
  let extraInDb = 0;
  for (const id of dbSet) if (!kgSet.has(id)) extraInDb++;
  return { missingInDb, extraInDb };
}

/**
 * So sánh dữ liệu DB với Kgara theo HdPhieuDichVuID (UUID).
 * Không ghi gì: chỉ tạo báo cáo, dùng cho dry-run.
 */
export function buildReconcileReport(
  dbCases: DbCaseSnapshot[],
  kgaraCases: KgaraCaseSnapshot[],
): ReconcileReport {
  const dbById = new Map(dbCases.map((c) => [c.hdPhieuDichVuId, c]));
  const kgById = new Map(kgaraCases.map((c) => [c.hdPhieuDichVuId, c]));

  const kgaraOnly = kgaraCases.filter((c) => !dbById.has(c.hdPhieuDichVuId));
  const dbOnly = dbCases.filter((c) => !kgById.has(c.hdPhieuDichVuId));

  const lineMismatchCases: CaseLineDiff[] = [];
  const totalMismatchCases: CaseLineDiff[] = [];
  let kgaraLines = 0;
  let dbLines = 0;
  let missingInDb = 0;
  let extraInDb = 0;

  for (const kg of kgaraCases) {
    kgaraLines += kg.lineIds.length;
    const db = dbById.get(kg.hdPhieuDichVuId);
    if (!db) continue;

    const diff = diffLines(kg.lineIds, db.lineIds);
    const row: CaseLineDiff = {
      soChungTu: kg.soChungTu,
      hdPhieuDichVuId: kg.hdPhieuDichVuId,
      kgLines: kg.lineIds.length,
      dbLines: db.lineIds.length,
      missingInDb: diff.missingInDb,
      extraInDb: diff.extraInDb,
      kgTotal: kg.tienCoThue,
      dbTotal: db.tienCoThue,
    };
    if (row.kgLines !== row.dbLines || diff.missingInDb || diff.extraInDb) {
      lineMismatchCases.push(row);
    }
    if (Math.abs(kg.tienCoThue - db.tienCoThue) > MONEY_EPSILON) {
      totalMismatchCases.push(row);
    }
  }

  for (const db of dbCases) {
    dbLines += db.lineIds.length;
  }
  for (const row of lineMismatchCases) {
    missingInDb += row.missingInDb;
    extraInDb += row.extraInDb;
  }

  return {
    kgaraCases: kgaraCases.length,
    dbCases: dbCases.length,
    kgaraOnly,
    dbOnly,
    lineMismatchCases,
    totalMismatchCases,
    totals: { kgaraLines, dbLines, missingInDb, extraInDb },
  };
}

/** Một dòng từ /api/v1/gr/exports/receivables của Kgara */
export interface KgaraReceivableRow {
  SoChungTu?: string | null;
  HdPhieuDichVuID?: string | null;
}

/** Dòng phiếu từ /api/v1/gr/cases/list; tài khoản OJ không có HdPhieuDichVuID */
export interface KgaraCaseListRow {
  SoChungTu?: string | null;
  HdPhieuDichVuID?: string | null;
}

/**
 * Map mã phiếu (SoChungTu) sang UUID (HdPhieuDichVuID).
 * Bỏ qua dòng thiếu một trong hai giá trị; mã trùng thì giữ bản ghi đầu tiên.
 */
export function buildGuidMap(rows: KgaraReceivableRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const code = row.SoChungTu?.trim();
    const guid = row.HdPhieuDichVuID?.trim();
    if (!code || !guid || map.has(code)) continue;
    map.set(code, guid);
  }
  return map;
}

/**
 * Trả về UUID HdPhieuDichVuID của phiếu, hoặc null nếu không xác định được.
 * Ưu tiên giá trị có sẵn trong dòng list; nếu không có (tài khoản OJ) thì tra theo SoChungTu.
 * Không bao giờ trả về undefined hoặc chuỗi rỗng, để tránh điều kiện where bị TypeORM bỏ qua.
 */
export function resolveCaseGuid(
  row: KgaraCaseListRow,
  guidBySoChungTu: Map<string, string>,
): string | null {
  const direct = row.HdPhieuDichVuID?.trim();
  if (direct) return direct;

  const code = row.SoChungTu?.trim();
  if (!code) return null;
  return guidBySoChungTu.get(code) ?? null;
}

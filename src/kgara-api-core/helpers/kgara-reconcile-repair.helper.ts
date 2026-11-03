/** Phiếu đang mang account OJ trong DB (kgara_cases.account_key = 'OJ') */
export interface OjDbCaseRow {
  hdPhieuDichVuId: string;
  soChungTu: string | null;
}

export interface RepairPlan {
  /** UUID thuộc phiếu MAIN trên Kgara nhưng đang gắn account OJ: đổi về MAIN rồi sync MAIN ghi đè đúng */
  toMain: string[];
  /** UUID không thuộc Kgara MAIN lẫn OJ: chỉ báo cáo, không xóa */
  staleOj: string[];
}

/**
 * Lập kế hoạch sửa các phiếu bị sync OJ ghi đè (R1).
 * Phiếu thuộc danh sách OJ trên Kgara là hợp lệ, giữ nguyên.
 * Pure function: không I/O, không ghi gì.
 */
export function planCorruptedRepairs(
  ojRows: OjDbCaseRow[],
  mainGuids: ReadonlySet<string>,
  ojGuids: ReadonlySet<string>,
): RepairPlan {
  const plan: RepairPlan = { toMain: [], staleOj: [] };
  for (const row of ojRows) {
    const id = row.hdPhieuDichVuId;
    if (ojGuids.has(id)) continue;
    if (mainGuids.has(id)) plan.toMain.push(id);
    else plan.staleOj.push(id);
  }
  return plan;
}

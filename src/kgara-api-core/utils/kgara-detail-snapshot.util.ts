/**
 * Snapshot các trường list-level tại thời điểm sync chi tiết phiếu.
 * List sync cập nhật cột (trạng thái, tiền, ngày hoàn thành) nhưng không lấy dòng chi tiết;
 * so snapshot với cột hiện tại để biết phiếu đã đổi và cần sync chi tiết lại.
 */
export interface KgaraDetailSnapshot {
  tinhTrang: number | null;
  tienCoThue: number;
  ngayHoanThanh: string | null;
}

interface SnapshotSource {
  tinhTrangDichVu?: number | null;
  tienCoThue?: number | string | null;
  ngayHoanThanhCongViec?: Date | string | null;
}

export function buildDetailSnapshot(c: SnapshotSource): KgaraDetailSnapshot {
  const done = c.ngayHoanThanhCongViec
    ? new Date(c.ngayHoanThanhCongViec)
    : null;
  return {
    tinhTrang: c.tinhTrangDichVu ?? null,
    tienCoThue: Number(c.tienCoThue ?? 0) || 0,
    ngayHoanThanh:
      done && !Number.isNaN(done.getTime()) ? done.toISOString() : null,
  };
}

/** Phiếu chưa có snapshot (dữ liệu cũ) coi là không cũ để tránh sync lại hàng loạt. */
export function isDetailStale(c: SnapshotSource & { rawData?: any }): boolean {
  const snap = c.rawData?.__detailSnapshot as KgaraDetailSnapshot | undefined;
  if (!snap) return false;
  const now = buildDetailSnapshot(c);
  return (
    snap.tinhTrang !== now.tinhTrang ||
    snap.tienCoThue !== now.tienCoThue ||
    snap.ngayHoanThanh !== now.ngayHoanThanh
  );
}

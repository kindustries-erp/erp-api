import { EntityManager, In } from 'typeorm';

import { KgaraCaseService } from '../entities/kgara_case_service.entity';

/** Một dòng chi tiết Kgara đã map sang các cột của KgaraCaseService */
export interface KgaraCaseLineInput {
  detailId: string;
  data: Partial<KgaraCaseService>;
}

export interface KgaraCaseLinesReconcileResult {
  upserted: number;
  softDeleted: number;
  conflicts: string[];
}

/**
 * Đối soát dòng chi tiết của một phiếu với dữ liệu vừa lấy từ Kgara.
 * - `lines` null/không phải mảng: không làm gì (không xóa dòng khi API không trả đủ dữ liệu).
 * - Dòng mới: thêm; dòng đã có của cùng phiếu: cập nhật và khôi phục nếu đang xóa mềm.
 * - Dòng đã thuộc phiếu khác: báo conflict, không chuyển cha âm thầm.
 * - Dòng của phiếu này nhưng không còn trong Kgara: xóa mềm.
 * Gọi trong cùng một transaction (manager là EntityManager của transaction).
 */
export async function reconcileCaseLines(
  manager: EntityManager,
  caseGuid: string,
  accountKey: string,
  lines: KgaraCaseLineInput[] | null | undefined,
): Promise<KgaraCaseLinesReconcileResult> {
  const result: KgaraCaseLinesReconcileResult = {
    upserted: 0,
    softDeleted: 0,
    conflicts: [],
  };
  if (!Array.isArray(lines)) return result;

  const repo = manager.getRepository(KgaraCaseService);
  const incomingIds = lines.map((line) => line.detailId);

  const ownRows = await repo.find({ where: { hdPhieuDichVuId: caseGuid } });
  const ownById = new Map(
    ownRows.map((row) => [row.hdPhieuDichVuChiTietId, row]),
  );

  const sameIdRows =
    incomingIds.length > 0
      ? await repo.find({ where: { hdPhieuDichVuChiTietId: In(incomingIds) } })
      : [];
  const foreignIds = new Set(
    sameIdRows
      .filter((row) => row.hdPhieuDichVuId !== caseGuid)
      .map((row) => row.hdPhieuDichVuChiTietId),
  );

  const toSave: KgaraCaseService[] = [];
  for (const line of lines) {
    if (foreignIds.has(line.detailId)) {
      result.conflicts.push(line.detailId);
      continue;
    }
    const row =
      ownById.get(line.detailId) ??
      repo.create({
        hdPhieuDichVuChiTietId: line.detailId,
        hdPhieuDichVuId: caseGuid,
      });
    Object.assign(row, line.data, { accountKey, deletedAt: null });
    toSave.push(row);
  }
  if (toSave.length > 0) {
    await repo.save(toSave);
    result.upserted = toSave.length;
  }

  const incomingSet = new Set(incomingIds);
  const staleIds = ownRows
    .filter(
      (row) => !row.deletedAt && !incomingSet.has(row.hdPhieuDichVuChiTietId),
    )
    .map((row) => row.id);
  if (staleIds.length > 0) {
    await repo.update({ id: In(staleIds) }, { deletedAt: new Date() });
    result.softDeleted = staleIds.length;
  }

  return result;
}

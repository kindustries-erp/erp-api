import { SelectQueryBuilder } from 'typeorm';

import { KgaraCase } from '../entities/kgara_case.entity';
import { getCaseColumnSelectExpr } from './kgara-case-filter.helper';

/**
 * Áp dụng sorts của bảng Vụ việc (`-col` là giảm dần) lên query alias `case`.
 * Dùng chung cho danh sách và xuất Excel theo filter hiện tại.
 */
export function applyCaseListSorts(
  query: SelectQueryBuilder<KgaraCase>,
  sorts: string | string[],
): void {
  const sortList = Array.isArray(sorts) ? sorts : [sorts];
  let first = true;
  for (const s of sortList) {
    const isDesc = s.startsWith('-');
    const col = isDesc ? s.substring(1) : s;
    const dir: 'ASC' | 'DESC' = isDesc ? 'DESC' : 'ASC';
    const nulls = isDesc ? 'NULLS LAST' : 'NULLS FIRST';

    let targetCol: string | null = null;
    if (col === 'caseDate' || col === 'ngayPhatSinh')
      targetCol = 'case.ngayPhatSinh';
    else if (col === 'ngayTiepNhan') targetCol = 'case.ngayTiepNhan';
    else if (col === 'ngayHoanThanhCongViec' || col === 'completionDate')
      targetCol = 'case.ngayHoanThanhCongViec';
    else if (col === 'soChungTu' || col === 'code' || col === 'caseCode')
      targetCol = 'case.soChungTu';
    else if (col === 'bienSoXe' || col === 'licensePlate')
      targetCol = 'case.bienSoXe';
    else if (col === 'khachHangName' || col === 'customerName')
      targetCol = 'case.khachHangName';
    else if (col === 'khachHangCode' || col === 'customerCode')
      targetCol = 'case.khachHangCode';
    else if (col === 'doanhThu') targetCol = 'case.doanhThu';
    else if (
      col === 'chiPhi' ||
      col === 'costProgress' ||
      col === 'tongPhaiTra' ||
      col === 'totalPayable' ||
      col === 'tienConPhaiChi' ||
      col === 'conPhaiTra' ||
      col === 'remainingPayable'
    )
      targetCol = 'case.chiPhi';
    else if (col === 'loiNhuan') targetCol = 'case.loiNhuan';
    else if (
      col === 'tienCoThue' ||
      col === 'totalAmount' ||
      col === 'collectionProgress' ||
      col === 'tongPhaiThu' ||
      col === 'totalReceivable'
    )
      targetCol = 'case.tienCoThue';
    else if (col === 'phaiThuKhachHang' || col === 'phaiThuKH')
      targetCol = `(${getCaseColumnSelectExpr('phaiThuKhachHang')})`;
    else if (col === 'phaiThuBaoHiem' || col === 'phaiThuBH')
      targetCol = `(${getCaseColumnSelectExpr('phaiThuBaoHiem')})`;
    else if (col === 'tienDaThanhToan' || col === 'paidAmount')
      targetCol = 'case.tienDaThanhToan';
    else if (
      col === 'tienConPhaiThanhToan' ||
      col === 'balanceAmount' ||
      col === 'conPhaiThu' ||
      col === 'remainingReceivable'
    )
      targetCol = 'case.tienConPhaiThanhToan';
    else if (col === 'updatedAt') targetCol = 'case.updatedAt';
    else if (col === 'createdAt') targetCol = 'case.createdAt';
    else if (col === 'classification') targetCol = 'case.classification';
    else if (col === 'kgaraClassification')
      targetCol = 'case.kgaraClassification';
    else if (col === 'kgaraClassificationCode')
      targetCol = 'case.kgaraClassificationCode';

    if (targetCol) {
      if (first) {
        query.orderBy(targetCol, dir, nulls);
        first = false;
      } else {
        query.addOrderBy(targetCol, dir, nulls);
      }
    }
  }
  query.addOrderBy('case.soChungTu', 'DESC');
}

/**
 * Thứ tự mặc định của bảng Vụ việc khi không có sorts. Dùng chung cho danh sách và
 * xuất Excel theo filter hiện tại để cùng một tập dòng ra cùng một thứ tự.
 */
export function applyCaseListDefaultOrder(
  query: SelectQueryBuilder<KgaraCase>,
): void {
  query
    .orderBy('case.ngayPhatSinh', 'DESC', 'NULLS LAST')
    .addOrderBy('case.ngayTiepNhan', 'DESC', 'NULLS LAST')
    .addOrderBy('case.soChungTu', 'DESC')
    .addOrderBy('case.updatedAt', 'DESC');
}

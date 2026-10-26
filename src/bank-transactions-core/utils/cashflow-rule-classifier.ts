import {
  CashflowClassification,
  CashflowPurpose,
} from '../constants/cashflow-attributes.constants';

/**
 * Bộ quy tắc phân loại dòng tiền theo nội dung sao kê (dùng cho backfill Q1/2026).
 *
 * Thuần (không DB, không IO): nhận một dòng giao dịch, trả về cặp Phân loại / Mục đích
 * hoặc null nếu không khớp quy tắc nào (dòng để kế toán duyệt tay).
 *
 * Thứ tự quy tắc có ý nghĩa: vay (theo tên) và chuyển nội bộ được xét trước,
 * vì nội dung của thu khách hàng cũng có thể chứa tên công ty.
 */

export interface CashflowRuleInput {
  isIn: boolean;
  correspondentName: string | null;
  description: string | null;
}

export interface CashflowRuleResult {
  classification: CashflowClassification;
  purpose: CashflowPurpose;
  reason: string;
}

/** Tên người/đối tác được xác nhận là vay (cả hai chiều: vào = nhận vay, ra = trả nợ). */
const LOAN_PARTY_PATTERN =
  /\b(NGUYEN NGOC HUY|TANG THI PHUONG NHUNG|HUYNH ANH KHOA|MI DE)\b/;

/** Tên công ty bảo hiểm / nội dung bồi thường (chỉ áp dụng cho tiền vào). */
const INSURANCE_PATTERN =
  /\b(BAO HIEM|TDBH|XECOGIOI|BAO88|BAO MINH|PJICO|BAO VIET|BAO LONG|BSH|BOI THUONG|BT XE|BIC|QUAN DOI)\b/;

/** Chuyển khoản giữa các tài khoản của chính công ty. */
const INTERNAL_PATTERN =
  /\b(CHUYEN VON NOI BO|CHUYEN KHOAN QUA TAI KHOAN)\b|\b(111886|886111|8680073168)\b.*\bCHUYEN\b/;

/** Thu từ khách hàng (QR, chuyển nhanh, GSM, thanh toán HĐ). */
const CUSTOMER_IN_PATTERN =
  /\b(GSM|GSMTT|MS01T15456542678087|QR|CHUYEN KHOAN NHANH|IBFT|THANH TOAN HD|THANH TOAN|CHUYEN TIEN THEO LO EMB)\b/;

const normalize = (value: string | null): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

const result = (
  classification: CashflowClassification,
  purpose: CashflowPurpose,
  reason: string,
): CashflowRuleResult => ({ classification, purpose, reason });

export const classifyCashflowByRule = (
  input: CashflowRuleInput,
): CashflowRuleResult | null => {
  const text = normalize(
    `${input.correspondentName ?? ''} ${input.description ?? ''}`,
  );

  if (LOAN_PARTY_PATTERN.test(text)) {
    return result('FINANCING', 'LOAN', 'vay cổ đông/chủ (danh sách tên)');
  }

  if (INTERNAL_PATTERN.test(text)) {
    return result('OTHER', 'INTERNAL_TRANSFER', 'chuyển nội bộ');
  }

  if (input.isIn) {
    if (INSURANCE_PATTERN.test(text)) {
      return result('OPERATING', 'INSURANCE_CLAIM', 'thu bồi thường bảo hiểm');
    }
    if (CUSTOMER_IN_PATTERN.test(text)) {
      return result('OPERATING', 'CUSTOMER_PAYMENT', 'thu khách hàng');
    }
    if (/\b(LAI SO DU|TRA LAI SO DU)\b/.test(text)) {
      return result('INVESTING', 'INTEREST_INCOME', 'lãi tiền gửi');
    }
    return null;
  }

  if (/\b(LUONG)\b/.test(text)) {
    return result('OPERATING', 'SALARY', 'lương');
  }
  if (/\b(BHXH|BAO HIEM XA HOI)\b/.test(text)) {
    return result('OPERATING', 'SOCIAL_INSURANCE', 'BHXH');
  }
  if (/\b(KBNN|KHO BAC)\b/.test(text)) {
    return result('OPERATING', 'TAX', 'nộp NSNN');
  }
  if (
    /\b(PHI QUAN LY TAI KHOAN|BIDV DIRECT|PHI DINH KY|HOMEBANKING|PHI QLTK)\b/.test(
      text,
    )
  ) {
    return result('OPERATING', 'BANK_FEE', 'phí ngân hàng');
  }
  if (/\bTHUE KHO\b/.test(text)) {
    return result('OPERATING', 'RENT', 'thuê kho');
  }
  if (/\b(HOAN TRA TIEN THUA|HOAN TIEN THUA)\b/.test(text)) {
    return result('OPERATING', 'REFUND', 'hoàn tiền thừa cho khách');
  }
  if (/\b(TAM UNG|HOAN UNG)\b/.test(text)) {
    return result('OPERATING', 'ADVANCE', 'tạm ứng/hoàn ứng');
  }
  if (/\b(XAY DUNG|PCCC|THI CONG|WORKMAN|HAN DESIGN)\b/.test(text)) {
    return result('INVESTING', 'ASSET_PURCHASE', 'xây dựng/thiết bị');
  }
  if (
    /\b(BAO VE|VE SINH|RAC|PHOTOCOPY|VPP|XANG|NUOC UONG|TIEP KHACH|QUA TET|KHACH SAN|TRANG TRI|MOI TRUONG|CUU HO|GIAO TE|VAN HANH|DICH VU|DIEN NUOC)\b/.test(
      text,
    )
  ) {
    return result('OPERATING', 'OPEX', 'chi phí vận hành');
  }
  if (
    /\b(THANH TOAN|VAT TU|THIET BI|PHAY MAM|PHU ANH|LAZANG|PHAY|TT HD|TT HOA DON)\b/.test(
      text,
    )
  ) {
    return result('OPERATING', 'SUPPLIER_PAYMENT', 'thanh toán NCC');
  }

  return null;
};

/**
 * vinfast-part-code.helper.ts
 *
 * Helper trích xuất mã linh kiện / phụ tùng VinFast & chuẩn hóa mã hàng hóa/dịch vụ đầu vào
 * (Cứu hộ, Chiết khấu, Thầu phụ, Dịch vụ tiện ích, Vật tư tiêu hao).
 */

export interface ExtractStandardItemCodeInput {
  description?: string | null;
  unit?: string | null;
  sellerName?: string | null;
  sellerTaxCode?: string | null;
  discountAmount?: number | null;
  preVatAmount?: number | null;
  itemCode?: string | null;
  existingItemCode?: string | null;
}

export interface StandardItemCodeResult {
  itemCode: string | null;
  itemType: 'PARTS' | 'SERVICE' | 'MATERIAL' | 'DISCOUNT' | 'OTHER';
  isDiscountDeduction: boolean;
  source:
    | 'EXISTING_PRESERVED'
    | 'VINFAST_PARTS'
    | 'RESCUE_RULE'
    | 'DISCOUNT_RULE'
    | 'SUBCONTRACT_RULE'
    | 'SERVICE_RULE'
    | 'CONSUMABLES_RULE'
    | 'FALLBACK';
}

/**
 * Trích xuất mã Part Number gốc của VinFast từ chuỗi diễn giải tên hàng hóa.
 */
export function extractVinfastItemCode(
  description: string | null | undefined,
): string | null {
  if (!description) return null;

  const upperDesc = description.toUpperCase().trim();
  const normalizedKey = upperDesc.replace(/[^A-Z0-9]+/g, '_');

  // 1. Nhận diện các gói pin cao áp đặc thù
  if (
    upperDesc.includes('VF5_HV_BATTERY_PACK_38_KWH') ||
    normalizedKey.includes('VF5_HV_BATTERY_PACK_38_KWH')
  ) {
    return 'EEP73110011AP';
  }

  if (
    upperDesc.includes('HV_BATTERY_41.9KWH') ||
    normalizedKey.includes('HV_BATTERY_41_9KWH') ||
    normalizedKey.includes('HV_BATTERY_41_9_KWH') ||
    upperDesc.includes('BAT21001011')
  ) {
    return 'BAT21001011';
  }

  if (
    upperDesc.includes('HV_BATTERY_PACK') ||
    normalizedKey.includes('HV_BATTERY_PACK')
  ) {
    return 'EEP73110011ALL';
  }

  // 2. Nhận diện động cơ điện bảo hành
  if (upperDesc.includes('ĐỘNG CƠ ĐIỆN') && upperDesc.includes('BẢO HÀNH')) {
    return 'PVT20030000';
  }

  // 3. Chuẩn mã phụ tùng VinFast ở đầu chuỗi (ngăn cách bởi dấu cách, gạch nối, hai chấm, phẩy)
  // Ví dụ: EEP63012001AB, BEX20000923, SVC20000011, CHS30019126, BEXSZT62052AA, BEXTM350503AB, BEXT3050505AA
  const prefixMatch = upperDesc.match(
    /^([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})(?:[\s\-_:,]|$)/,
  );
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].toUpperCase();
  }

  // 4. Fallback tìm từ mã phụ tùng theo ranh giới từ ở bất kỳ vị trí nào
  const wordBoundaryMatch = upperDesc.match(
    /\b([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})\b/,
  );
  if (wordBoundaryMatch && wordBoundaryMatch[1]) {
    return wordBoundaryMatch[1].toUpperCase();
  }

  return null;
}

const REGEX_CUU_HO =
  /(cứu hộ|cuu ho|kéo xe|keo xe|cẩu xe|cau xe|chở xe|xe cứu hộ|xe cuu ho|towing|cứu hộ giao thông)/i;
const REGEX_CHIET_KHAU =
  /(chiết khấu|chiet khau|giảm giá|giam gia|khuyến mại|khuyen mai|hàng tặng|hang tang|không thu tiền|khong thu tien|\bck\b|discount)/i;
const REGEX_GIA_CONG_THAU_PHU =
  /(gia công mâm|phục hồi mâm|hàn lazang|phục hồi thước lái|tiện đĩa thắng|gia công đồng sơn|dịch vụ kỹ thuật ngoài|tháo lắp kính|sửa chữa vỏ pin|thay cầu chì pyro|thay thế cầu chì pyro|sửa xe \d+)/i;
const REGEX_DICH_VU_VAN_HANH =
  /(bảo vệ|vệ sinh|rác thải|thu gom|thuê|cước|vận chuyển|chuyển phát|tư vấn|luật|phần mềm|internet|tiện ích|photocopy|kiểm định|đăng kiểm|gửi xe|bảo hiểm|vé cầu đường|phí cầu đường)/i;
const REGEX_VAT_TU_TIEU_HAO =
  /(sơn|son|dầu|dau|nhớt|nhot|gas lạnh|gas|keo|bóng|đóng rắn|dung môi|mỡ|băng keo|giấy nhám|vải lau|nước làm mát)/i;

/**
 * Phân loại và trích xuất mã hàng chuẩn hóa bằng Rule-based Fallback.
 * Hoạt động khi AI offline, timeout, hoặc confidence < 0.7.
 */
export function extractStandardItemCode(
  input: ExtractStandardItemCodeInput,
): StandardItemCodeResult {
  const desc = (input.description || '').trim();
  const unit = (input.unit || '').trim().toLowerCase();
  const seller = (input.sellerName || '').toUpperCase();
  const sellerTax = String(input.sellerTaxCode || '').replace(/\s+/g, '');
  const preVat = Number(input.preVatAmount || 0);
  const discount = Number(input.discountAmount || 0);
  const upperDesc = desc.toUpperCase();

  // 1. Preserve Guard: Nếu đã có mã hợp lệ trước đó
  const codeToPreserve = input.existingItemCode || input.itemCode;
  if (
    codeToPreserve &&
    codeToPreserve.trim() !== '' &&
    codeToPreserve.toUpperCase() !== 'NULL'
  ) {
    const isDisc =
      codeToPreserve.startsWith('CK-') || discount > 0 || preVat < 0;
    return {
      itemCode: codeToPreserve.trim(),
      itemType: isDisc
        ? 'DISCOUNT'
        : codeToPreserve.startsWith('DV-')
          ? 'SERVICE'
          : codeToPreserve.startsWith('VT-')
            ? 'MATERIAL'
            : 'PARTS',
      isDiscountDeduction: isDisc,
      source: 'EXISTING_PRESERVED',
    };
  }

  // 2. Kiểm tra mã phụ tùng VinFast gốc
  const vfCode = extractVinfastItemCode(desc);
  if (
    vfCode ||
    seller.includes('VINFAST') ||
    ['0108926276', '0202357718', '0318334886'].includes(sellerTax)
  ) {
    if (vfCode) {
      const isService = ['EEH', 'EMT', 'LFP'].some((p) => vfCode.startsWith(p));
      return {
        itemCode: vfCode,
        itemType: isService ? 'SERVICE' : 'PARTS',
        isDiscountDeduction: preVat < 0,
        source: 'VINFAST_PARTS',
      };
    }
  }

  // 3. Cứu hộ & Kéo xe
  if (
    REGEX_CUU_HO.test(desc) ||
    REGEX_CUU_HO.test(unit) ||
    seller.includes('VÂN SƠN') ||
    seller.includes('CỨU HỘ')
  ) {
    let itemCode = 'DV-CUUHO';
    if (
      seller.includes('VÂN SƠN') ||
      upperDesc.includes('VÂN SƠN') ||
      upperDesc.includes('VAN SON')
    ) {
      itemCode = 'DV-CUUHO-VANSON';
    } else if (seller.includes('911') || upperDesc.includes('911')) {
      itemCode = 'DV-CUUHO-911';
    }

    return {
      itemCode,
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'RESCUE_RULE',
    };
  }

  // 4. Chiết khấu / Giảm giá (Deduction)
  if (
    discount > 0 ||
    preVat < 0 ||
    REGEX_CHIET_KHAU.test(desc) ||
    REGEX_CHIET_KHAU.test(unit)
  ) {
    let itemCode = 'CK-THUONGMAI';
    if (seller.includes('GRAB') || upperDesc.includes('GRAB')) {
      itemCode = 'CK-GRAB';
    } else if (
      seller.includes('DI CHUYỂN XANH') ||
      seller.includes('GSM') ||
      upperDesc.includes('GSM') ||
      upperDesc.includes('XANH SM')
    ) {
      itemCode = 'CK-GSM';
    }

    return {
      itemCode,
      itemType: 'DISCOUNT',
      isDiscountDeduction: true,
      source: 'DISCOUNT_RULE',
    };
  }

  // 5. Gia công thầu phụ / Tiền công
  if (
    REGEX_GIA_CONG_THAU_PHU.test(desc) ||
    seller.includes('TNT') ||
    seller.includes('DƯƠNG QUÝ DÂN') ||
    unit === 'công' ||
    unit === 'giờ'
  ) {
    let itemCode = 'DV-GIACONG-NGOAI';
    if (desc.toLowerCase().includes('mâm') || seller.includes('TNT'))
      itemCode = 'DV-GIACONG-MAM';
    else if (desc.toLowerCase().includes('thước lái'))
      itemCode = 'DV-GIACONG-THUOCLAI';
    else if (desc.toLowerCase().includes('pyro')) itemCode = 'DV-THAY-PYRO';
    else if (desc.toLowerCase().includes('vỏ pin')) itemCode = 'DV-SUACHUA-PIN';

    return {
      itemCode,
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'SUBCONTRACT_RULE',
    };
  }

  // 6. Dịch vụ tiện ích & Vận hành
  if (
    REGEX_DICH_VU_VAN_HANH.test(desc) ||
    ['chuyến', 'tháng', 'gói', 'trọn gói', 'lần', 'ca'].includes(unit) ||
    seller.includes('THẮNG LỢI') ||
    seller.includes('TRÍ ĐỨC') ||
    seller.includes('WELLSPRING') ||
    seller.includes('W&A') ||
    seller.includes('GRAB') ||
    seller.includes('VIETTEL')
  ) {
    let itemCode = 'DV-TIENICH';
    if (seller.includes('THẮNG LỢI') || desc.toLowerCase().includes('bảo vệ'))
      itemCode = 'DV-BAOVE';
    else if (
      seller.includes('TRÍ ĐỨC') ||
      desc.toLowerCase().includes('vệ sinh')
    )
      itemCode = 'DV-VESINH';
    else if (
      seller.includes('W&A') ||
      seller.includes('WELLSPRING') ||
      desc.toLowerCase().includes('tư vấn')
    )
      itemCode = 'DV-TUVAN';
    else if (
      seller.includes('GRAB') ||
      seller.includes('VIETTEL') ||
      desc.toLowerCase().includes('cước') ||
      unit === 'chuyến'
    )
      itemCode = 'DV-CUOC-GIAOHANG';
    else if (desc.toLowerCase().includes('rác')) itemCode = 'DV-RACTHAI';

    return {
      itemCode,
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'SERVICE_RULE',
    };
  }

  // 7. Nguyên vật liệu & Vật tư tiêu hao
  if (
    REGEX_VAT_TU_TIEU_HAO.test(desc) ||
    ['lít', 'can', 'lon', 'chai', 'tuýp', 'kg', 'kilogram'].includes(unit)
  ) {
    let itemCode = 'VT-TIEUHAO-XUONG';
    if (
      desc.toLowerCase().includes('sơn') ||
      desc.toLowerCase().includes('bóng')
    )
      itemCode = 'VT-SON-2K';
    else if (
      desc.toLowerCase().includes('dầu') ||
      desc.toLowerCase().includes('nhớt')
    )
      itemCode = 'VT-DAU-NHOT';
    else if (desc.toLowerCase().includes('gas')) itemCode = 'VT-GAS-R134';
    else if (desc.toLowerCase().includes('làm mát'))
      itemCode = 'VT-NUOC-LAMMAT';

    return {
      itemCode,
      itemType: 'MATERIAL',
      isDiscountDeduction: false,
      source: 'CONSUMABLES_RULE',
    };
  }

  // 8. Hàng hóa / Khác
  return {
    itemCode: desc.toLowerCase().includes('nước') ? 'HH-NUOC-UONG' : 'HH-CHUNG',
    itemType: 'OTHER',
    isDiscountDeduction: false,
    source: 'FALLBACK',
  };
}

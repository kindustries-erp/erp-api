/**
 * vinfast-part-code.helper.ts
 *
 * Helper trích xuất và chuẩn hóa mã hàng hóa/dịch vụ đầu vào bằng hệ thống tiền tố (Prefix Taxonomy):
 * - Phụ tùng VinFast: VF-<PART_NO>
 * - Phụ tùng OEM / Khác: PT-<PART_NO>
 * - Vật tư tiêu hao: VT-SON, VT-GAS, VT-DAU-NHOT, VT-KEO, VT-HOACHAT, VT-TIEU-HAO
 * - Dịch vụ & Thầu phụ: DV-CUUHO, DV-GIACONG, DV-SUACHUA, DV-VANCHUYEN, DV-BAOVE, DV-VESINH, DV-TUVAN, DV-IT, DV-INAN
 * - Chiết khấu: CK-GSM, CK-GRAB, CK-THUONGMAI
 * - Công cụ dụng cụ: CCDC-XUONG, CCDC-VP
 * - Hành chính & VPP: HC-NUOC, HC-VPP
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
    | 'OEM_PARTS'
    | 'RESCUE_RULE'
    | 'DISCOUNT_RULE'
    | 'SUBCONTRACT_RULE'
    | 'SERVICE_RULE'
    | 'CONSUMABLES_RULE'
    | 'TOOLS_RULE'
    | 'ADMIN_RULE'
    | 'FALLBACK';
}

/**
 * Trích xuất mã Part Number gốc của VinFast từ chuỗi diễn giải tên hàng hóa và tự động thêm tiền tố VF-.
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
    return 'VF-EEP73110011AP';
  }

  if (
    upperDesc.includes('HV_BATTERY_41.9KWH') ||
    normalizedKey.includes('HV_BATTERY_41_9KWH') ||
    normalizedKey.includes('HV_BATTERY_41_9_KWH') ||
    upperDesc.includes('BAT21001011')
  ) {
    return 'VF-BAT21001011';
  }

  if (
    upperDesc.includes('HV_BATTERY_PACK') ||
    normalizedKey.includes('HV_BATTERY_PACK')
  ) {
    return 'VF-EEP73110011ALL';
  }

  // 2. Nhận diện động cơ điện bảo hành
  if (upperDesc.includes('ĐỘNG CƠ ĐIỆN') && upperDesc.includes('BẢO HÀNH')) {
    return 'VF-PVT20030000';
  }

  // 3. Chuẩn mã phụ tùng VinFast ở đầu chuỗi (ngăn cách bởi dấu cách, gạch nối, hai chấm, phẩy)
  // Ví dụ: EEP63012001AB, BEX20000923, SVC20000011, CHS30019126, BEXSZT62052AA, BEXTM350503AB, BEXT3050505AA
  const prefixMatch = upperDesc.match(
    /^(?:VF-)?([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})(?:[\s\-_:,]|$)/,
  );
  if (prefixMatch && prefixMatch[1]) {
    return `VF-${prefixMatch[1].toUpperCase()}`;
  }

  // 4. Mã số thuần 5-10 số (VinFast classic part numbers)
  const numericMatch = upperDesc.match(/^(?:VF-)?([0-9]{5,10})(?:[\s\-_:,]|$)/);
  if (numericMatch && numericMatch[1]) {
    return `VF-${numericMatch[1]}`;
  }

  // 5. Fallback tìm từ mã phụ tùng theo ranh giới từ ở bất kỳ vị trí nào
  const wordBoundaryMatch = upperDesc.match(
    /\b([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})\b/,
  );
  if (wordBoundaryMatch && wordBoundaryMatch[1]) {
    return `VF-${wordBoundaryMatch[1].toUpperCase()}`;
  }

  return null;
}

/**
 * Trích xuất mã Part Number OEM từ mô tả (Ví dụ: 0K95K15909, 214432B020, 225/60R17, 97701-Q6400, A2055018201)
 */
export function extractOemPartNumber(
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  const upperDesc = description.toUpperCase().trim();

  // Pattern Part No ở đầu chuỗi (chứa chữ cái, số, gạch nối, gạch chéo, độ dài 4-20 ký tự)
  const oemMatch = upperDesc.match(
    /^(?:PT-)?([0-9A-Z]{2,6}[-_/]?[0-9A-Z]{3,12}(?:[-_/][0-9A-Z]{1,6})?)(?:[\s:,]|$)/,
  );
  if (oemMatch && oemMatch[1]) {
    const raw = oemMatch[1].trim();
    // Bỏ qua các từ thông thường
    if (!['LOC', 'BO', 'CON', 'CAI', 'CHIEC', 'BIEU', 'BANG'].includes(raw)) {
      return `PT-${raw}`;
    }
  }

  // Pattern lốp xe đặc thù: 225/60R17, 205/55R16, 215/60R16...
  const tireMatch = upperDesc.match(/\b([1-3][0-9]{2}\/[0-9]{2}R[0-9]{2})\b/);
  if (tireMatch && tireMatch[1]) {
    return `PT-${tireMatch[1]}`;
  }

  return null;
}

const REGEX_CUU_HO =
  /(cứu hộ|cuu ho|kéo xe|keo xe|cẩu xe|cau xe|chở xe|xe cứu hộ|xe cuu ho|towing|cứu hộ giao thông|vân sơn|van son|911)/i;
const REGEX_CHIET_KHAU =
  /(chiết khấu|chiet khau|giảm giá|giam gia|khuyến mại|khuyen mai|hàng tặng|hang tang|không thu tiền|khong thu tien|\bck\b|discount)/i;
const REGEX_GIA_CONG =
  /(gia công mâm|phục hồi mâm|hàn lazang|phục hồi thước lái|tiện đĩa thắng|tiện láng|ép bạc đạn|gia công đồng sơn|cắt gọt cơ khí)/i;
const REGEX_SUA_CHUA =
  /(sửa chữa ngoài|sửa chữa thầu phụ|tháo lắp kính|sửa chữa vỏ pin|sửa củ đề|sửa máy phát|thay cầu chì pyro|thay thế cầu chì pyro|sửa xe \d+)/i;
const REGEX_VAN_CHUYEN =
  /(cước chuyển phát|chuyển phát nhanh|cước vận chuyển|cước phí vận chuyển|giao hàng|grab express|viettel post|ship hàng)/i;

// Nhóm vật tư chuyên dụng
const REGEX_VT_SON =
  /(sơn|son|bóng 2k|keo bóng|chất đóng rắn|đóng rắn|dung môi pha sơn|sơn lót|sơn màu|sơn 2k)/i;
const REGEX_VT_GAS = /(gas lạnh|gas r134|gas r1234|r134a|r1234yf|\bgas\b)/i;
const REGEX_VT_DAU_NHOT =
  /(dầu động cơ|dầu nhớt|dầu hộp số|nhớt phuy|nhớt can|mỡ bôi trơn|mỡ bò|\bnhớt\b|\bdầu nhớt\b)/i;
const REGEX_VT_KEO =
  /(keo silicon|keo dán kính|keo ab|keo bọt|keo trám|keo ron|keo a500|keo a600)/i;
const REGEX_VT_HOACHAT =
  /(nước làm mát|chất tẩy sơn|dung dịch tẩy|nước rửa kính|tẩy rỉ sét|hóa chất tẩy)/i;
const REGEX_VT_TIEU_HAO =
  /(giấy nhám|nhám tròn|nhám tờ|giẻ lau|khăn lau|băng keo|bạt phủ|bạt nilong|phễu lọc sơn|lon pha|găng tay|quần bảo hộ|áo bảo hộ|áo thun|bóng đèn|dây điện|vật tư phụ)/i;

// Công cụ dụng cụ
const REGEX_CCDC_XUONG =
  /(súng siết|súng bắn|máy nén khí|cẩu móc|cẩu máy|cuộn rulo|cuộn ống|tủ đồ nghề|con đội|kích nâng|cờ lê|mỏ lết|bộ tuýp|đồng hồ áp suất)/i;
const REGEX_CCDC_VP =
  /(camera quan sát|thiết bị chuyển mạch|switch|tp-link|quạt tản nhiệt cpu|máy in|dji mic|tai nghe|chuột máy tính)/i;

// Hành chính & VPP
const REGEX_HC_NUOC =
  /(nước uống|biwase|viva|lavie|aquafina|ion life|nước đóng chai)/i;
const REGEX_HC_VPP =
  /(giấy in|giấy a4|bìa còng|giấy in bill|bút bi|sổ tay|văn phòng phẩm)/i;

/**
 * Đảm bảo mã luôn có tiền tố chuẩn hợp lệ (Prefix Normalizer).
 */
export function normalizePrefix(
  rawCode: string | null | undefined,
  fallbackType:
    | 'PARTS'
    | 'SERVICE'
    | 'MATERIAL'
    | 'DISCOUNT'
    | 'OTHER' = 'PARTS',
): string {
  if (!rawCode || rawCode.trim() === '' || rawCode.toUpperCase() === 'NULL') {
    return fallbackType === 'MATERIAL'
      ? 'VT-TIEU-HAO'
      : fallbackType === 'SERVICE'
        ? 'DV-SUACHUA'
        : fallbackType === 'DISCOUNT'
          ? 'CK-THUONGMAI'
          : 'PT-CHUNG';
  }

  let code = rawCode.trim().toUpperCase();

  // 1. Đã có prefix chuẩn hợp lệ
  const validPrefixes = ['VF-', 'PT-', 'VT-', 'DV-', 'CK-', 'CCDC-', 'HC-'];
  if (validPrefixes.some((p) => code.startsWith(p))) {
    // Chuẩn hóa trường hợp đặc biệt cũ
    if (code.startsWith('VT-SON-') || code === 'VT-SON') return 'VT-SON';
    if (code.startsWith('VT-GAS-') || code === 'VT-GAS') return 'VT-GAS';
    if (code.startsWith('VT-DAU-') || code === 'VT-DAU-NHOT')
      return 'VT-DAU-NHOT';
    if (
      code.startsWith('VT-CHAT-TAY') ||
      code.startsWith('VT-NUOC-LAMMAT') ||
      code === 'VT-HOACHAT'
    )
      return 'VT-HOACHAT';
    if (
      code.startsWith('VT-BOHO') ||
      code.startsWith('VT-TIEUHAO') ||
      code.startsWith('VT-DIEN-NUOC') ||
      code === 'VT-PHU-XUONG' ||
      code === 'VT-TIEU-HAO'
    )
      return 'VT-TIEU-HAO';
    if (code.startsWith('DV-CUUHO-') || code === 'DV-CUUHO') return 'DV-CUUHO';
    if (
      code.startsWith('DV-CUOC-') ||
      code === 'DV-CUOC' ||
      code === 'DV-VANCHUYEN'
    )
      return 'DV-VANCHUYEN';
    return code;
  }

  // 2. Mã phụ tùng VinFast chuẩn (BEX, PWT, BAT, EEP, BIW, MEC, FWH, SVC, CHS, PVT, EEH, EMT, LFP...)
  const vfLetters = [
    'BEX',
    'PWT',
    'BAT',
    'EEP',
    'BIW',
    'MEC',
    'FWH',
    'SVC',
    'CHS',
    'PVT',
    'EEH',
    'EMT',
    'LFP',
  ];
  if (vfLetters.some((p) => code.startsWith(p))) {
    return `VF-${code}`;
  }

  // 3. Mã số thuần (VinFast numeric part number)
  if (/^[0-9]{5,10}$/.test(code)) {
    return `VF-${code}`;
  }

  // 4. Các mã OEM khác
  return `PT-${code}`;
}

/**
 * Phân loại và trích xuất mã hàng chuẩn hóa bằng Rule-based Fallback.
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

  // 1. Preserve Guard (với chuẩn hóa tiền tố nếu là mã cũ)
  const codeToPreserve = input.existingItemCode || input.itemCode;
  if (
    codeToPreserve &&
    codeToPreserve.trim() !== '' &&
    codeToPreserve.toUpperCase() !== 'NULL'
  ) {
    const isDisc =
      codeToPreserve.startsWith('CK-') || discount > 0 || preVat < 0;
    const normalizedCode = normalizePrefix(
      codeToPreserve,
      isDisc ? 'DISCOUNT' : 'PARTS',
    );
    return {
      itemCode: normalizedCode,
      itemType: isDisc
        ? 'DISCOUNT'
        : normalizedCode.startsWith('DV-')
          ? 'SERVICE'
          : normalizedCode.startsWith('VT-')
            ? 'MATERIAL'
            : 'PARTS',
      isDiscountDeduction: isDisc,
      source: 'EXISTING_PRESERVED',
    };
  }

  // 2. Chiết khấu / Giảm giá (Deduction)
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

  // 3. Phụ tùng VinFast
  const vfCode = extractVinfastItemCode(desc);
  if (
    vfCode ||
    seller.includes('VINFAST') ||
    ['0108926276', '0202357718', '0318334886'].includes(sellerTax)
  ) {
    if (vfCode) {
      const isService = ['EEH', 'EMT', 'LFP'].some((p) =>
        vfCode.replace('VF-', '').startsWith(p),
      );
      return {
        itemCode: vfCode,
        itemType: isService ? 'SERVICE' : 'PARTS',
        isDiscountDeduction: preVat < 0,
        source: 'VINFAST_PARTS',
      };
    }
  }

  // 4. Cứu hộ kéo xe (Gộp chung thành DV-CUUHO)
  if (
    REGEX_CUU_HO.test(desc) ||
    REGEX_CUU_HO.test(unit) ||
    seller.includes('VÂN SƠN') ||
    seller.includes('CỨU HỘ')
  ) {
    return {
      itemCode: 'DV-CUUHO',
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'RESCUE_RULE',
    };
  }

  // 5. Cước vận chuyển / Giao nhận phụ tùng
  if (
    REGEX_VAN_CHUYEN.test(desc) ||
    (seller.includes('GRAB') && !REGEX_CHIET_KHAU.test(desc)) ||
    seller.includes('VIETTEL')
  ) {
    return {
      itemCode: 'DV-VANCHUYEN',
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'SERVICE_RULE',
    };
  }

  // 6. Gia công ngoài & Sửa chữa
  if (REGEX_GIA_CONG.test(desc) || seller.includes('TNT')) {
    let itemCode = 'DV-GIACONG';
    if (desc.toLowerCase().includes('mâm')) itemCode = 'DV-GIACONG-MAM';
    else if (desc.toLowerCase().includes('thước lái'))
      itemCode = 'DV-GIACONG-THUOCLAI';
    return {
      itemCode,
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'SUBCONTRACT_RULE',
    };
  }

  if (REGEX_SUA_CHUA.test(desc) || unit === 'công' || unit === 'giờ') {
    return {
      itemCode: 'DV-SUACHUA',
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'SUBCONTRACT_RULE',
    };
  }

  // 7. Dịch vụ tiện ích quản trị (Bảo vệ, Vệ sinh, Tư vấn, IT, In ấn)
  if (seller.includes('THẮNG LỢI') || desc.toLowerCase().includes('bảo vệ')) {
    return {
      itemCode: 'DV-BAOVE',
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'SERVICE_RULE',
    };
  }
  if (seller.includes('TRÍ ĐỨC') || desc.toLowerCase().includes('vệ sinh')) {
    return {
      itemCode: 'DV-VESINH',
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'SERVICE_RULE',
    };
  }
  if (
    seller.includes('W&A') ||
    seller.includes('WELLSPRING') ||
    desc.toLowerCase().includes('tư vấn')
  ) {
    return {
      itemCode: 'DV-TUVAN',
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'SERVICE_RULE',
    };
  }
  if (
    desc.toLowerCase().includes('in ấn') ||
    desc.toLowerCase().includes('in bill')
  ) {
    return {
      itemCode: 'DV-INAN',
      itemType: 'SERVICE',
      isDiscountDeduction: false,
      source: 'SERVICE_RULE',
    };
  }

  // 8. Vật tư tiêu hao xưởng (VT-*)
  if (REGEX_VT_SON.test(desc)) {
    return {
      itemCode: 'VT-SON',
      itemType: 'MATERIAL',
      isDiscountDeduction: false,
      source: 'CONSUMABLES_RULE',
    };
  }
  if (REGEX_VT_GAS.test(desc)) {
    return {
      itemCode: 'VT-GAS',
      itemType: 'MATERIAL',
      isDiscountDeduction: false,
      source: 'CONSUMABLES_RULE',
    };
  }
  if (REGEX_VT_DAU_NHOT.test(desc)) {
    return {
      itemCode: 'VT-DAU-NHOT',
      itemType: 'MATERIAL',
      isDiscountDeduction: false,
      source: 'CONSUMABLES_RULE',
    };
  }
  if (REGEX_VT_KEO.test(desc)) {
    return {
      itemCode: 'VT-KEO',
      itemType: 'MATERIAL',
      isDiscountDeduction: false,
      source: 'CONSUMABLES_RULE',
    };
  }
  if (REGEX_VT_HOACHAT.test(desc)) {
    return {
      itemCode: 'VT-HOACHAT',
      itemType: 'MATERIAL',
      isDiscountDeduction: false,
      source: 'CONSUMABLES_RULE',
    };
  }
  if (REGEX_VT_TIEU_HAO.test(desc)) {
    return {
      itemCode: 'VT-TIEU-HAO',
      itemType: 'MATERIAL',
      isDiscountDeduction: false,
      source: 'CONSUMABLES_RULE',
    };
  }

  // 9. Công cụ dụng cụ (CCDC-*)
  if (REGEX_CCDC_XUONG.test(desc)) {
    return {
      itemCode: 'CCDC-XUONG',
      itemType: 'MATERIAL',
      isDiscountDeduction: false,
      source: 'TOOLS_RULE',
    };
  }
  if (REGEX_CCDC_VP.test(desc)) {
    return {
      itemCode: 'CCDC-VP',
      itemType: 'MATERIAL',
      isDiscountDeduction: false,
      source: 'TOOLS_RULE',
    };
  }

  // 10. Hành chính & VPP (HC-*)
  if (REGEX_HC_NUOC.test(desc)) {
    return {
      itemCode: 'HC-NUOC',
      itemType: 'OTHER',
      isDiscountDeduction: false,
      source: 'ADMIN_RULE',
    };
  }
  if (REGEX_HC_VPP.test(desc)) {
    return {
      itemCode: 'HC-VPP',
      itemType: 'OTHER',
      isDiscountDeduction: false,
      source: 'ADMIN_RULE',
    };
  }

  // 11. Phụ tùng OEM các hãng khác (PT-*)
  const oemCode = extractOemPartNumber(desc);
  if (oemCode) {
    return {
      itemCode: oemCode,
      itemType: 'PARTS',
      isDiscountDeduction: false,
      source: 'OEM_PARTS',
    };
  }

  // 12. Fallback
  return {
    itemCode: 'PT-CHUNG',
    itemType: 'OTHER',
    isDiscountDeduction: false,
    source: 'FALLBACK',
  };
}

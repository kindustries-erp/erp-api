/**
 * vinfast-part-code.helper.ts
 *
 * Helper trích xuất mã linh kiện / phụ tùng VinFast từ chuỗi diễn giải tên hàng hóa.
 * Hỗ trợ các mã tiêu chuẩn (3-6 ký tự chữ + 5-8 ký tự số + 0-3 hậu tố), pin cao áp, động cơ bảo hành.
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

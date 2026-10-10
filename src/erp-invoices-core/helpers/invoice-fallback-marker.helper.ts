/**
 * Marker ghi vào mô tả bút toán khi hóa đơn mua vào bị hạch toán vào TK tạm T0003
 * (không phân loại được). Dùng để kế toán dò tay và để script chạy lại nhận diện.
 *   [T0003_FALLBACK]            - không rõ lý do
 *   [T0003_FALLBACK:AI_ERROR]   - AI lỗi / phản hồi không parse được
 *   [T0003_FALLBACK:LOW_CONFIDENCE] | [T0003_FALLBACK:INVALID_CODE]
 */
const MARKER_PATTERN = /\s*\[T0003_FALLBACK(?::[A-Z_]+)?\]/g;

export function buildFallbackMarker(reason?: string | null): string {
  const clean = (reason || '').trim().toUpperCase();
  return /^[A-Z_]+$/.test(clean)
    ? `[T0003_FALLBACK:${clean}]`
    : '[T0003_FALLBACK]';
}

export function hasFallbackMarker(description?: string | null): boolean {
  return new RegExp(MARKER_PATTERN.source).test(description || '');
}

export function stripFallbackMarker(
  description?: string | null,
): string | null {
  if (description === null || description === undefined) return null;
  return description.replace(MARKER_PATTERN, '').trim();
}

/** Gắn marker vào cuối mô tả khi `isFallback`; ngược lại trả nguyên mô tả. */
export function withFallbackMarker(
  description: string,
  isFallback: boolean,
  reason?: string | null,
): string {
  if (!isFallback) return description;
  return `${stripFallbackMarker(description)} ${buildFallbackMarker(reason)}`;
}

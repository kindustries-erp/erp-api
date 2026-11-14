/** Lỗi khi câu trả lời của model không phải JSON object hợp lệ. */
export class AiJsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiJsonParseError';
  }
}

/**
 * Lấy JSON object từ câu trả lời của model.
 * Chấp nhận JSON trần, JSON bọc trong ```json ... ``` hoặc có lời dẫn trước/sau.
 */
export function parseAiJson(content: string): Record<string, unknown> {
  const text = (content ?? '').trim();
  if (!text) throw new AiJsonParseError('Model trả về nội dung rỗng');

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new AiJsonParseError('Không tìm thấy JSON object trong câu trả lời');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AiJsonParseError('JSON trong câu trả lời không hợp lệ');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AiJsonParseError('Câu trả lời không phải JSON object');
  }
  return parsed as Record<string, unknown>;
}

/** Ép giá trị model trả về thành số; chấp nhận "1.234,5", "1,234.5", "12 000". */
export function toAiNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.replace(/[^\d.,-]/g, '');
  if (!text) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Dấu đứng sau là dấu thập phân, dấu còn lại là phân cách nghìn
    const [decimal, thousand] = lastComma > lastDot ? [',', '.'] : ['.', ','];
    text = text.split(thousand).join('').replace(decimal, '.');
  } else {
    const mark = lastComma >= 0 ? ',' : '.';
    const parts = text.split(mark);
    // Một dấu và phần đuôi đúng 3 chữ số, hoặc nhiều dấu: phân cách nghìn
    const isThousand =
      parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    text = isThousand ? parts.join('') : parts.join('.');
  }
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

export function toAiText(value: unknown, maxLength = 255): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

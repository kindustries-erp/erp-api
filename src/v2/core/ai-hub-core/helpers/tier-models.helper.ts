import { AI_TIERS, AiTier, AiTierModels } from '../contracts/ai-hub.contract';

export function isAiTier(value: unknown): value is AiTier {
  return (
    typeof value === 'string' && (AI_TIERS as readonly string[]).includes(value)
  );
}

/** Một tier nhận một tên model hoặc mảng tên model; bỏ giá trị rỗng, không phải chuỗi và trùng. */
function toModelList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [value];
  const models = raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(models)];
}

/**
 * Đọc JSON tier → model từ env, vd `{"low":"a","high":["b","c"]}`.
 * Mảng là danh sách dự phòng theo thứ tự ưu tiên. Bỏ key lạ và tier không có model.
 * JSON hỏng hoặc không phải object trả về `{}` để nơi gọi báo lỗi cấu hình theo tier.
 */
export function parseTierModels(raw: string | null | undefined): AiTierModels {
  if (!raw?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const result: AiTierModels = {};
  for (const tier of AI_TIERS) {
    const models = toModelList((parsed as Record<string, unknown>)[tier]);
    if (models.length) result[tier] = models;
  }
  return result;
}

/** Chọn tier từ giá trị cấu hình; giá trị không hợp lệ thì dùng tier mặc định. */
export function resolveTier(value: unknown, fallback: AiTier): AiTier {
  const normalized =
    typeof value === 'string' ? value.trim().toLowerCase() : '';
  return isAiTier(normalized) ? normalized : fallback;
}

/** Hợp đồng dùng chung của họ AI Hub v2. Lõi không gọi mạng, không biết nhà cung cấp. */

/** Tên tier khai báo trong env `NINE_ROUTER_TIER_MODELS`. Code chỉ gọi theo tier, không theo tên model. */
export const AI_TIERS = ['low', 'medium', 'high', 'ultra'] as const;
export type AiTier = (typeof AI_TIERS)[number];

/** Model của từng tier theo thứ tự ưu tiên: model đầu lỗi thì thử model kế. */
export type AiTierModels = Partial<Record<AiTier, string[]>>;

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentPart[];
}

export interface AiCompletionRequest {
  tier: AiTier;
  /** Mã tính năng gọi AI, dùng để thống kê usage (vd `GARAGE_PR_INVOICE`). */
  featureCode: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Thời gian chờ tối đa cho mỗi lần gọi model (ms). Bỏ trống: dùng mặc định của gateway. */
  timeoutMs?: number;
  actorUserId?: string;
  requestId?: string;
  /** Thông tin phụ ghi vào log. Không đưa nội dung tài liệu vào đây. */
  meta?: Record<string, unknown>;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiCompletionResult {
  content: string;
  tier: AiTier;
  model: string;
  usage: AiUsage;
  latencyMs: number;
}

/** Cổng gọi model. Module gateway hiện thực; lõi và module nghiệp vụ chỉ phụ thuộc cổng này. */
export interface AiGatewayPort {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}

/** Tài liệu người dùng tải lên (ảnh hoặc PDF), giữ trong bộ nhớ. */
export interface AiDocumentFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface AiCallContext {
  actorUserId?: string;
  requestId?: string;
}

export interface AiExtractionResult<T> {
  data: T;
  tier: AiTier;
  model: string;
  latencyMs: number;
}

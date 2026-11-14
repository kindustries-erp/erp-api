import { UnprocessableEntityException } from '@nestjs/common';
import {
  AiCallContext,
  AiDocumentFile,
  AiExtractionResult,
  AiGatewayPort,
  AiTier,
} from '../contracts/ai-hub.contract';
import { AiJsonParseError, parseAiJson } from '../helpers/ai-json.helper';
import { buildVisionMessages } from '../helpers/vision-message.helper';

/**
 * Khung "đọc tài liệu bằng AI": gửi ảnh/PDF kèm prompt, nhận JSON, chuẩn hóa về kiểu `T`.
 * Lớp con khai báo tính năng, tier, prompt và cách chuẩn hóa; không tự gọi mạng.
 */
export abstract class AbstractAiDocumentAgentService<T> {
  protected constructor(protected readonly gateway: AiGatewayPort) {}

  /** Mã tính năng ghi vào usage log. */
  protected abstract readonly featureCode: string;
  protected abstract readonly systemPrompt: string;
  protected abstract readonly userPrompt: string;

  /** Tier dùng cho lần gọi này (đọc từ cấu hình của module). */
  protected abstract resolveTier(): AiTier;

  /** Chuẩn hóa JSON thô của model về `T`. Ném `AiJsonParseError` khi thiếu dữ liệu bắt buộc. */
  protected abstract normalize(raw: Record<string, unknown>): T;

  protected readonly maxTokens: number = 4096;

  /** Thời gian chờ mỗi lần gọi model (ms). Đọc tài liệu thường lâu hơn mặc định của gateway. */
  protected resolveTimeoutMs(): number | undefined {
    return undefined;
  }

  async extract(
    file: AiDocumentFile,
    context: AiCallContext = {},
  ): Promise<AiExtractionResult<T>> {
    const result = await this.gateway.complete({
      tier: this.resolveTier(),
      featureCode: this.featureCode,
      messages: buildVisionMessages(this.systemPrompt, this.userPrompt, file),
      temperature: 0,
      maxTokens: this.maxTokens,
      timeoutMs: this.resolveTimeoutMs(),
      actorUserId: context.actorUserId,
      requestId: context.requestId,
      meta: {
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
      },
    });

    try {
      return {
        data: this.normalize(parseAiJson(result.content)),
        tier: result.tier,
        model: result.model,
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      if (error instanceof AiJsonParseError) {
        throw new UnprocessableEntityException(
          `AI không đọc được tài liệu: ${error.message}. Vui lòng thử ảnh rõ hơn.`,
        );
      }
      throw error;
    }
  }
}

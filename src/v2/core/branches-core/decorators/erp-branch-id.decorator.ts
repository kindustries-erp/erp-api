import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

/** Header chi nhánh ERP (`branches_management.id`) gửi kèm khi người dùng chọn chi nhánh; không gửi = mọi chi nhánh. */
export const ERP_BRANCH_HEADER = 'x-erp-branch-id';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Đọc và kiểm header chi nhánh ERP; trả `undefined` khi trống, ném 400 khi không phải UUID. */
export function parseErpBranchHeader(raw: unknown): string | undefined {
  const value = (Array.isArray(raw) ? raw[0] : raw) as string | undefined;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return undefined;
  if (!UUID_RE.test(trimmed)) {
    throw new BadRequestException(`${ERP_BRANCH_HEADER} không hợp lệ.`);
  }
  return trimmed;
}

/** Chi nhánh ERP đang chọn (không bắt buộc). Dùng cho module v2 lọc theo `branch_id`. */
export const ErpBranchId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, unknown>;
    }>();
    return parseErpBranchHeader(request.headers[ERP_BRANCH_HEADER]);
  },
);

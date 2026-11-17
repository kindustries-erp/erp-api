import { BadRequestException } from '@nestjs/common';

export interface RequestWithUser {
  user?: { sub?: string };
}

/** Chi nhánh lấy từ header; công nợ và thu chi luôn cách ly theo chi nhánh. */
export function requireBranch(branchId: string | undefined): string {
  if (!branchId) throw new BadRequestException('Thiếu chi nhánh.');
  return branchId;
}

/** `Idempotency-Key` bắt buộc cho lệnh đổi số dư, tối đa 128 ký tự (khớp cột `idempotency_key`). */
export function requireIdempotencyKey(key: string | undefined): string {
  const value = key?.trim();
  if (!value || value.length > 128) {
    throw new BadRequestException(
      'Thiếu hoặc sai header Idempotency-Key (tối đa 128 ký tự).',
    );
  }
  return value;
}

export const actorOf = (req: RequestWithUser): string | null =>
  req.user?.sub ?? null;

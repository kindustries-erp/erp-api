import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ApprovalSetting } from './entities/approval-setting.entity';

/**
 * Chế độ duyệt của một họ chứng từ, suy ra từ khóa trong erp_approval_settings:
 * - LEGACY: chưa có dòng khóa (họ thường). Hành vi cũ: duyệt theo quyền, người duyệt tùy chọn.
 * - REQUIRED: khóa bật. Bắt buộc chọn người duyệt khi gửi, chỉ người đó duyệt/từ chối được.
 * - AUTO: khóa tắt. Gửi duyệt là tự duyệt (DRAFT → APPROVED).
 */
export type ApprovalMode = 'LEGACY' | 'REQUIRED' | 'AUTO';

export function resolveApprovalMode(
  setting: Pick<ApprovalSetting, 'approvalEnabled'> | null,
): ApprovalMode {
  if (!setting) return 'LEGACY';
  return setting.approvalEnabled ? 'REQUIRED' : 'AUTO';
}

/** Đọc khóa trong cùng transaction với chứng từ. */
export async function loadApprovalMode(
  manager: EntityManager,
  docType: string,
): Promise<ApprovalMode> {
  const setting = await manager
    .getRepository(ApprovalSetting)
    .findOne({ where: { docType } });
  return resolveApprovalMode(setting);
}

export interface SubmitDecision {
  /** Trạng thái đích sau submit: PENDING_APPROVAL, hoặc APPROVED khi tự duyệt. */
  autoApprove: boolean;
  approverId: string | null;
}

/**
 * Quyết định khi gửi duyệt theo chế độ. Hàm thuần: không truy vấn DB.
 * Người gửi không được tự chọn chính mình làm người duyệt.
 */
export function resolveSubmitDecision(
  mode: ApprovalMode,
  actorId: string,
  approverId: string | null | undefined,
): SubmitDecision {
  if (mode === 'AUTO') {
    return { autoApprove: true, approverId: null };
  }
  const chosen = approverId ?? null;
  if (mode === 'REQUIRED' && !chosen) {
    throw new BadRequestException('Bắt buộc chọn người duyệt');
  }
  if (chosen && chosen === actorId) {
    throw new BadRequestException('Không được chọn chính mình làm người duyệt');
  }
  return { autoApprove: false, approverId: chosen };
}

/**
 * Chỉ người được chỉ định mới duyệt/từ chối được. Chứng từ không có người duyệt
 * (họ thường hoặc còn tồn từ trước khi bật khóa) thì giữ kiểm tra theo quyền như cũ.
 */
export function assertCanDecide(
  approverId: string | null,
  actorId: string,
): void {
  if (approverId && approverId !== actorId) {
    throw new ForbiddenException(
      'Chỉ người duyệt được chỉ định mới được duyệt hoặc từ chối',
    );
  }
}

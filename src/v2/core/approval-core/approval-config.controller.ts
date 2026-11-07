import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '../rbac-core/enums';
import { ApprovalSettingsService } from './approval-settings.service';
import { ApproverDirectoryService } from './approver-directory.service';
import { UpdateApprovalSettingDto } from './dto/approval-action.dto';

interface RequestWithUser {
  user?: { sub?: string };
}

export interface ApprovalConfigOptions {
  /** Đường dẫn gốc, ví dụ `api/v2/approval-config/garage-procurement-requests`. */
  path: string;
  /** Mã họ chứng từ lưu trong erp_approval_settings. */
  docType: string;
  /** Resource quyền của chứng từ (dùng để liệt kê người duyệt). */
  resource: ErpResource;
  tag: string;
}

/**
 * Tạo controller cấu hình duyệt cho một họ chứng từ. Lõi chứa logic; module
 * chỉ khai báo docType và resource. Mọi endpoint đều qua JwtAuthGuard và CoreRbacGuard.
 *  - GET  {path}/approvers: danh sách người có quyền duyệt (không gồm người gọi).
 *  - GET  {path}/setting: trạng thái khóa duyệt hiện tại.
 *  - PATCH {path}/setting: bật/tắt khóa, chỉ admin (quyền admin_users:update).
 */
export function createApprovalConfigController(opts: ApprovalConfigOptions) {
  @ApiTags(opts.tag)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CoreRbacGuard)
  @Controller(opts.path)
  class ApprovalConfigController {
    constructor(
      readonly settings: ApprovalSettingsService,
      readonly approvers: ApproverDirectoryService,
    ) {}

    @RequirePermissions({ resource: opts.resource, action: ErpAction.UPDATE })
    @Get('approvers')
    listApprovers(@Req() req: RequestWithUser) {
      return this.approvers.listApprovers(opts.resource, req.user?.sub ?? null);
    }

    @RequirePermissions({ resource: opts.resource, action: ErpAction.READ })
    @Get('setting')
    async getSetting() {
      return {
        docType: opts.docType,
        approvalEnabled: await this.settings.isEnabled(opts.docType),
      };
    }

    @RequirePermissions({
      resource: ErpResource.ADMIN_USERS,
      action: ErpAction.UPDATE,
    })
    @Patch('setting')
    async updateSetting(
      @Body() dto: UpdateApprovalSettingDto,
      @Req() req: RequestWithUser,
    ) {
      const row = await this.settings.setEnabled(
        opts.docType,
        dto.approvalEnabled,
        req.user?.sub ?? '',
      );
      return { docType: row.docType, approvalEnabled: row.approvalEnabled };
    }
  }
  return ApprovalConfigController;
}

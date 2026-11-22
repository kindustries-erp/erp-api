import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { UsersManagement } from '@/v2/modules/users-management/entities/users-management.entity';
import { ApprovalEvent } from './entities/approval-event.entity';
import { ApprovalSetting } from './entities/approval-setting.entity';
import { ApprovalActorService } from './services/approval-actor.service';
import { ApprovalEventService } from './services/approval-event.service';
import { ApprovalSettingsService } from './services/approval-settings.service';
import { ApproverDirectoryService } from './services/approver-directory.service';

/**
 * Cài đặt cụ thể của duyệt chứng từ: nhật ký (erp_approval_events), khóa duyệt
 * (erp_approval_settings), tra người thực hiện và danh sách người duyệt.
 * Module chứng từ (PR, PO, kho) import module này; controller cấu hình duyệt
 * của từng họ do chính module chứng từ tạo bằng createApprovalConfigController.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ApprovalEvent, ApprovalSetting, UsersManagement]),
    RbacCoreModule,
  ],
  providers: [
    ApprovalEventService,
    ApprovalSettingsService,
    ApprovalActorService,
    ApproverDirectoryService,
  ],
  exports: [
    TypeOrmModule,
    ApprovalEventService,
    ApprovalSettingsService,
    ApprovalActorService,
    ApproverDirectoryService,
  ],
})
export class ApprovalManagementModule {}

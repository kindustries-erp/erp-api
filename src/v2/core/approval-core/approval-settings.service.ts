import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalSetting } from './entities/approval-setting.entity';
import { ApprovalMode, resolveApprovalMode } from './approval-gate.helper';

/** Đọc và ghi khóa bật/tắt duyệt theo họ chứng từ. */
@Injectable()
export class ApprovalSettingsService {
  constructor(
    @InjectRepository(ApprovalSetting)
    private readonly repo: Repository<ApprovalSetting>,
  ) {}

  async getMode(docType: string): Promise<ApprovalMode> {
    const row = await this.repo.findOne({ where: { docType } });
    return resolveApprovalMode(row);
  }

  /** Không có dòng khóa thì trả về `fallback` (mặc định cũ: bật). */
  async isEnabled(docType: string, fallback = true): Promise<boolean> {
    const row = await this.repo.findOne({ where: { docType } });
    return row ? row.approvalEnabled : fallback;
  }

  /** Bật/tắt khóa duyệt. Tạo dòng nếu chưa có. */
  async setEnabled(
    docType: string,
    enabled: boolean,
    actorId: string,
  ): Promise<ApprovalSetting> {
    const row =
      (await this.repo.findOne({ where: { docType } })) ??
      this.repo.create({ docType });
    row.approvalEnabled = enabled;
    row.updatedBy = actorId;
    return this.repo.save(row);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FILE_ATTACHMENT_SETTINGS_ID,
  FileAttachmentSettings,
} from '../entities/file-attachment-settings.entity';
import {
  FileAttachmentSettingsResponseDto,
  UpdateFileAttachmentSettingsDto,
} from '../dto/update-file-attachment-settings.dto';

/** Cài đặt lưu giữ toàn hệ thống (một dòng). Mặc định: tắt tự động dọn, giữ 30 ngày. */
@Injectable()
export class FileAttachmentSettingsService {
  constructor(
    @InjectRepository(FileAttachmentSettings)
    private readonly repo: Repository<FileAttachmentSettings>,
  ) {}

  /** Đọc cài đặt; chưa có dòng thì tạo dòng mặc định. */
  async get(): Promise<FileAttachmentSettings> {
    const existing = await this.repo.findOne({
      where: { id: FILE_ATTACHMENT_SETTINGS_ID },
    });
    if (existing) return existing;
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({
        id: FILE_ATTACHMENT_SETTINGS_ID,
        autoPurgeEnabled: false,
        retentionDays: 30,
      })
      .orIgnore()
      .execute();
    return this.repo.findOneOrFail({
      where: { id: FILE_ATTACHMENT_SETTINGS_ID },
    });
  }

  async update(
    dto: UpdateFileAttachmentSettingsDto,
    userId: string | null,
  ): Promise<FileAttachmentSettings> {
    const current = await this.get();
    if (dto.autoPurgeEnabled !== undefined) {
      current.autoPurgeEnabled = dto.autoPurgeEnabled;
    }
    if (dto.retentionDays !== undefined) {
      current.retentionDays = dto.retentionDays;
    }
    current.updatedBy = userId;
    return this.repo.save(current);
  }

  toResponse(row: FileAttachmentSettings): FileAttachmentSettingsResponseDto {
    return {
      autoPurgeEnabled: row.autoPurgeEnabled,
      retentionDays: row.retentionDays,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }
}

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import AdmZip from 'adm-zip';
import { toPagedList } from '@/common/utils/paginated-result';
import {
  FileOwnerRegistry,
  STORAGE_POLICY_PROVIDER,
  type FileCategory,
  type FileOwnerType,
  type StoragePolicyProvider,
} from '@/v2/core/file-attachments-core';
import { Inject } from '@nestjs/common';
import type { FileAttachmentResponseDto } from './dto/file-attachment-response.dto';
import type { QueryFileAttachmentDto } from './dto/query-file-attachment.dto';
import type { UpdateFileAttachmentSettingsDto } from './dto/update-file-attachment-settings.dto';
import { toFileAttachmentResponse } from './helpers/file-attachment.mapper';
import {
  FileAttachmentCommandService,
  type UploadedFileInput,
} from './services/file-attachment-command.service';
import { FileAttachmentPurgeService } from './services/file-attachment-purge.service';
import { FileAttachmentQueryService } from './services/file-attachment-query.service';
import { FileAttachmentSettingsService } from './services/file-attachment-settings.service';
import { FileStorageGateway } from './services/file-storage.gateway';

const ZIP_MAX_FILES = 100;
const ZIP_MAX_BYTES = 200 * 1024 * 1024;

/** Tên file trong zip không trùng: `a.pdf`, `a_1.pdf`, `a_2.pdf`... */
function uniqueZipName(name: string, used: Set<string>): string {
  const match = name.match(/^(.*?)(\.[^.]+)?$/);
  const base = match?.[1] || name;
  const ext = match?.[2] ?? '';
  let candidate = name;
  for (let i = 1; used.has(candidate); i++) candidate = `${base}_${i}${ext}`;
  used.add(candidate);
  return candidate;
}

/** Facade của module: controller (theo owner và quản lý) chỉ gọi lớp này. */
@Injectable()
export class FileAttachmentsService {
  private readonly logger = new Logger(FileAttachmentsService.name);

  constructor(
    private readonly command: FileAttachmentCommandService,
    private readonly query: FileAttachmentQueryService,
    private readonly purgeService: FileAttachmentPurgeService,
    private readonly settings: FileAttachmentSettingsService,
    private readonly gateway: FileStorageGateway,
    private readonly owners: FileOwnerRegistry,
    @Inject(STORAGE_POLICY_PROVIDER)
    private readonly policies: StoragePolicyProvider,
  ) {}

  // ---- Theo owner ----

  async listForOwner(ownerType: FileOwnerType, ownerId: string) {
    const owner = this.owners.get(ownerType);
    await owner.assertExists(ownerId);
    const rows = await this.query.listByOwner(ownerType, ownerId);
    const [defaultCategory] = owner.allowedCategories();
    const policy = await this.policies.resolve(ownerType, defaultCategory);
    return toPagedList(
      rows.map(toFileAttachmentResponse),
      1,
      Math.max(1, rows.length),
      rows.length,
      { policy, categories: owner.allowedCategories() },
    );
  }

  async uploadForOwner(input: {
    ownerType: FileOwnerType;
    ownerId: string;
    files: UploadedFileInput[];
    category: FileCategory;
    userId: string | null;
  }) {
    const rows = await this.command.upload(input);
    return {
      message: 'Đã tải tài liệu lên',
      data: rows.map(toFileAttachmentResponse),
    };
  }

  async downloadUrlForOwner(
    ownerType: FileOwnerType,
    ownerId: string,
    attachmentId: string,
    inline: boolean,
  ) {
    await this.owners.get(ownerType).assertExists(ownerId);
    const row = await this.query.getForOwner(ownerType, ownerId, attachmentId);
    return {
      message: 'OK',
      data: await this.gateway.presignDownload(
        row.fileKey,
        row.fileName,
        inline,
      ),
    };
  }

  /** Gói tất cả file chưa xóa của owner thành một zip (tên trùng được đánh số). */
  async zipForOwner(ownerType: FileOwnerType, ownerId: string) {
    await this.owners.get(ownerType).assertExists(ownerId);
    const rows = await this.query.listByOwner(ownerType, ownerId);
    if (rows.length === 0) {
      throw new NotFoundException('Không có tài liệu nào để tải');
    }
    if (rows.length > ZIP_MAX_FILES) {
      throw new BadRequestException(`Tối đa ${ZIP_MAX_FILES} file mỗi lần tải`);
    }
    const total = rows.reduce((sum, r) => sum + Number(r.fileSize || 0), 0);
    if (total > ZIP_MAX_BYTES) {
      throw new BadRequestException('Tổng dung lượng vượt giới hạn tải zip');
    }
    const zip = new AdmZip();
    const used = new Set<string>();
    let added = 0;
    for (const row of rows) {
      try {
        const buffer = await this.gateway.downloadBuffer(row.fileKey);
        zip.addFile(uniqueZipName(row.fileName, used), buffer);
        added++;
      } catch (error) {
        // Một file thiếu trên kho (dữ liệu cũ) không làm hỏng cả gói, giống hành vi V1.
        this.logger.warn(`Bỏ qua file ${row.id} khi tạo zip: ${String(error)}`);
      }
    }
    if (added === 0) {
      throw new BadGatewayException(
        'Không đọc được tài liệu nào từ kho lưu trữ',
      );
    }
    return zip.toBuffer();
  }

  async deleteForOwner(
    ownerType: FileOwnerType,
    ownerId: string,
    attachmentId: string,
    userId: string | null,
  ) {
    const row = await this.command.softDeleteForOwner(
      ownerType,
      ownerId,
      attachmentId,
      userId,
    );
    return { message: 'Đã xóa tài liệu', data: toFileAttachmentResponse(row) };
  }

  // ---- Quản lý toàn hệ thống ----

  async list(query: QueryFileAttachmentDto) {
    const page = await this.query.findAll(query);
    return toPagedList(
      page.items.map(toFileAttachmentResponse),
      page.page,
      page.pageSize,
      page.total,
    );
  }

  columnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    query: Parameters<FileAttachmentQueryService['findColumnOptions']>[4],
  ) {
    return this.query.findColumnOptions(column, search, page, pageSize, query);
  }

  async detail(
    id: string,
  ): Promise<{ message: string; data: FileAttachmentResponseDto }> {
    return {
      message: 'OK',
      data: toFileAttachmentResponse(await this.query.getById(id)),
    };
  }

  async downloadUrl(id: string, inline: boolean) {
    const row = await this.query.getById(id);
    return {
      message: 'OK',
      data: await this.gateway.presignDownload(
        row.fileKey,
        row.fileName,
        inline,
      ),
    };
  }

  async softDelete(id: string, userId: string | null) {
    const row = await this.command.softDeleteById(id, userId);
    return { message: 'Đã xóa tài liệu', data: toFileAttachmentResponse(row) };
  }

  async purge(ids: string[], userId: string | null) {
    const result = await this.purgeService.purge(ids, {
      userId,
      source: 'MANUAL',
    });
    return { message: 'Đã xử lý xóa vĩnh viễn', data: result };
  }

  /** Xóa cứng một file; bị bỏ qua (chưa xóa mềm, lỗi R2...) thì báo xung đột. */
  async purgeOne(id: string, userId: string | null) {
    const { data } = await this.purge([id], userId);
    const skipped = data.skipped[0];
    if (skipped) {
      throw new ConflictException({
        message: 'Không xóa vĩnh viễn được tài liệu',
        reason: skipped.reason,
      });
    }
    return { message: 'Đã xóa vĩnh viễn', data: data.purged[0] };
  }

  async getSettings() {
    return {
      message: 'OK',
      data: this.settings.toResponse(await this.settings.get()),
    };
  }

  async updateSettings(
    dto: UpdateFileAttachmentSettingsDto,
    userId: string | null,
  ) {
    const row = await this.settings.update(dto, userId);
    return { message: 'Đã lưu cài đặt', data: this.settings.toResponse(row) };
  }
}

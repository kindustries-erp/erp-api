import { createHash } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FileCategory,
  FileOrigin,
  FileOwnerRegistry,
  STORAGE_POLICY_PROVIDER,
  buildStorageKey,
  extensionOf,
  sanitizeFileName,
  type FileOwnerType,
  type StoragePolicy,
  type StoragePolicyProvider,
} from '@/v2/core/storage-core';
import { FileAttachment } from '../entities/file-attachment.entity';
import { FileStorageGateway } from './file-storage.gateway';

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadFilesInput {
  ownerType: FileOwnerType;
  ownerId: string;
  files: UploadedFileInput[];
  category: FileCategory;
  isOriginal?: boolean;
  userId: string | null;
}

@Injectable()
export class FileAttachmentCommandService {
  private readonly logger = new Logger(FileAttachmentCommandService.name);

  constructor(
    @InjectRepository(FileAttachment)
    private readonly repo: Repository<FileAttachment>,
    private readonly gateway: FileStorageGateway,
    private readonly owners: FileOwnerRegistry,
    @Inject(STORAGE_POLICY_PROVIDER)
    private readonly policies: StoragePolicyProvider,
  ) {}

  /** Upload nhiều file: R2 trước, DB trong một transaction; lỗi DB thì xóa object vừa upload. */
  async upload(input: UploadFilesInput): Promise<FileAttachment[]> {
    const { ownerType, ownerId, files, category, userId } = input;
    const owner = this.owners.get(ownerType);
    if (!owner.allowedCategories().includes(category)) {
      throw new BadRequestException('Nhóm tài liệu không hợp lệ');
    }
    if (!files?.length) {
      throw new BadRequestException('Chưa chọn file nào');
    }
    await owner.assertExists(ownerId);
    await owner.assertCanModify(ownerId);

    const policy = await this.policies.resolve(ownerType, category);
    this.validate(files, policy);

    const uploadedKeys: string[] = [];
    try {
      const rows: FileAttachment[] = [];
      for (const file of files) {
        const fileName = sanitizeFileName(file.originalname);
        const fileKey = buildStorageKey(ownerType, fileName);
        await this.gateway.upload(fileKey, file.buffer, file.mimetype);
        uploadedKeys.push(fileKey);
        rows.push(
          this.repo.create({
            ownerType,
            ownerId,
            category,
            isOriginal: input.isOriginal ?? false,
            fileName,
            fileKey,
            origin: FileOrigin.V2,
            legacySource: null,
            fileSize: String(file.size),
            mimeType: file.mimetype,
            checksumSha256: createHash('sha256')
              .update(file.buffer)
              .digest('hex'),
            createdBy: userId,
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
          }),
        );
      }
      return await this.repo.manager.transaction((m) => m.save(rows));
    } catch (error) {
      await this.rollbackObjects(uploadedKeys);
      throw error;
    }
  }

  /** Xóa mềm theo owner: `attachmentId` phải khớp owner (chặn IDOR). Không đụng object R2. */
  async softDeleteForOwner(
    ownerType: FileOwnerType,
    ownerId: string,
    attachmentId: string,
    userId: string | null,
  ): Promise<FileAttachment> {
    const owner = this.owners.get(ownerType);
    await owner.assertExists(ownerId);
    await owner.assertCanModify(ownerId);
    const row = await this.repo.findOne({
      where: { id: attachmentId, ownerType, ownerId, isDeleted: false },
    });
    if (!row) throw new NotFoundException('Không tìm thấy tài liệu');
    return this.markDeleted(row, userId);
  }

  /** Xóa mềm theo id (trang quản lý toàn hệ thống, đã qua RBAC). */
  async softDeleteById(
    id: string,
    userId: string | null,
  ): Promise<FileAttachment> {
    const row = await this.repo.findOne({ where: { id, isDeleted: false } });
    if (!row) throw new NotFoundException('Không tìm thấy tài liệu');
    return this.markDeleted(row, userId);
  }

  private async markDeleted(
    row: FileAttachment,
    userId: string | null,
  ): Promise<FileAttachment> {
    row.isDeleted = true;
    row.deletedAt = new Date();
    row.deletedBy = userId;
    return this.repo.save(row);
  }

  private validate(files: UploadedFileInput[], policy: StoragePolicy): void {
    if (files.length > policy.maxFilesPerRequest) {
      throw new BadRequestException(
        `Tối đa ${policy.maxFilesPerRequest} file mỗi lần`,
      );
    }
    for (const file of files) {
      if (!file.size || file.size > policy.maxFileBytes) {
        throw new BadRequestException(
          `File "${sanitizeFileName(file.originalname)}" vượt giới hạn dung lượng`,
        );
      }
      const ext = extensionOf(file.originalname);
      if (!policy.allowedExtensions.includes(ext)) {
        throw new BadRequestException(`Không hỗ trợ định dạng .${ext || '?'}`);
      }
      if (!policy.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Loại nội dung ${file.mimetype} không được phép`,
        );
      }
    }
  }

  private async rollbackObjects(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.gateway.delete(key);
      } catch {
        this.logger.warn(`Không dọn được object mồ côi: ${key}`);
      }
    }
  }
}

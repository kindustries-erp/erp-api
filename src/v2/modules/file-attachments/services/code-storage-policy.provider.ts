import { Injectable } from '@nestjs/common';
import {
  STORAGE_HARD_LIMITS,
  type FileCategory,
  type FileOwnerType,
  type StoragePolicy,
  type StoragePolicyProvider,
} from '@/v2/core/storage-core';

/** Giới hạn mặc định cố định trong code. Đổi sang cấu hình được = thay provider này. */
export const DEFAULT_STORAGE_POLICY: StoragePolicy = {
  maxFileBytes: STORAGE_HARD_LIMITS.maxFileBytes,
  maxFilesPerRequest: STORAGE_HARD_LIMITS.maxFilesPerRequest,
  allowedExtensions: [
    'pdf',
    'png',
    'jpg',
    'jpeg',
    'webp',
    'xlsx',
    'xls',
    'docx',
    'doc',
    'zip',
    'xml',
  ],
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
    'application/xml',
    'text/xml',
  ],
};

@Injectable()
export class CodeStoragePolicyProvider implements StoragePolicyProvider {
  async resolve(
    _ownerType: FileOwnerType,
    _category: FileCategory,
  ): Promise<StoragePolicy> {
    const policy = { ...DEFAULT_STORAGE_POLICY };
    // Không bao giờ vượt trần cứng của interceptor.
    policy.maxFileBytes = Math.min(
      policy.maxFileBytes,
      STORAGE_HARD_LIMITS.maxFileBytes,
    );
    policy.maxFilesPerRequest = Math.min(
      policy.maxFilesPerRequest,
      STORAGE_HARD_LIMITS.maxFilesPerRequest,
    );
    return policy;
  }
}

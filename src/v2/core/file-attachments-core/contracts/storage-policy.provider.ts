import type { FileCategory, FileOwnerType } from '../types/file-owner.types';

/** Trần cứng cho interceptor (multer chỉ nhận giá trị tĩnh). Policy thật không bao giờ vượt các giá trị này. */
export const STORAGE_HARD_LIMITS = {
  maxFileBytes: 20 * 1024 * 1024,
  maxFilesPerRequest: 10,
} as const;

/** Giới hạn upload hiệu lực cho một (owner, category). Web nhận bản này qua `extraData.policy`. */
export interface StoragePolicy {
  maxFileBytes: number;
  maxFilesPerRequest: number;
  /** Đuôi cho phép, chữ thường, không dấu chấm. */
  allowedExtensions: string[];
  /** MIME cho phép (đối chiếu thêm với đuôi). */
  allowedMimeTypes: string[];
}

/**
 * Nguồn policy upload. Bản mặc định đọc hằng số trong code; muốn cấu hình được sau này
 * chỉ cần cung cấp provider khác (đọc DB), không sửa controller hay web.
 */
export interface StoragePolicyProvider {
  resolve(
    ownerType: FileOwnerType,
    category: FileCategory,
  ): Promise<StoragePolicy>;
}

export const STORAGE_POLICY_PROVIDER = Symbol('STORAGE_POLICY_PROVIDER');

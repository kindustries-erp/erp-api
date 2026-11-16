import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_KEY_REFERENCE_SOURCES,
  type FileKeyReferenceSource,
} from '@/v2/core/file-attachments-core';

export interface KeyReferenceReport {
  total: number;
  bySource: Record<string, number>;
}

/**
 * Đếm số nơi còn tham chiếu một khóa R2, cộng mọi nguồn đã đăng ký.
 * Thêm nguồn mới (vd. bảng của Garage PR) chỉ cần đăng ký thêm `FileKeyReferenceSource`.
 */
@Injectable()
export class FileKeyReferenceChecker {
  constructor(
    @Inject(FILE_KEY_REFERENCE_SOURCES)
    private readonly sources: FileKeyReferenceSource[],
  ) {}

  async count(
    fileKey: string,
    excludeId?: string,
  ): Promise<KeyReferenceReport> {
    const counts = await Promise.all(
      this.sources.map(
        async (s) => [s.name, await s.count(fileKey, excludeId)] as const,
      ),
    );
    const bySource: Record<string, number> = {};
    let total = 0;
    for (const [name, n] of counts) {
      bySource[name] = n;
      total += n;
    }
    return { total, bySource };
  }
}

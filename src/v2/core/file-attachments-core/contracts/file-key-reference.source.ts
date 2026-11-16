/**
 * Một nơi có thể đang tham chiếu khóa R2 (bảng file khác, cột khóa của chứng từ...).
 * Trước khi xóa object, `count` của mọi nguồn đã đăng ký được cộng lại.
 */
export interface FileKeyReferenceSource {
  readonly name: string;
  /** Số tham chiếu tới `fileKey`, không tính dòng `excludeId` (dòng đang bị xóa). */
  count(fileKey: string, excludeId?: string): Promise<number>;
}

export const FILE_KEY_REFERENCE_SOURCES = Symbol('FILE_KEY_REFERENCE_SOURCES');

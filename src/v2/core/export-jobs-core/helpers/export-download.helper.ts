export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Nguồn file đã tạo xong: `ExportJobRunner` hoặc service kế thừa `AbstractExportJobService`. */
export interface ExportFileSource {
  getReadyFile(
    jobId: string,
    userId: string,
  ): { buffer: Buffer; fileName: string };
}

export interface ExportDownloadResponseLike {
  setHeader(name: string, value: string): unknown;
  send(body: unknown): unknown;
}

export interface SendReadyExportFileOptions {
  /** `encodeURIComponent` tên file trong `Content-Disposition` (công nợ hóa đơn dùng kiểu này). */
  encodeFileName?: boolean;
  /** Mặc định `XLSX_MIME`. */
  contentType?: string;
}

/** Gửi file đã tạo xong của một job về client. */
export function sendReadyExportFile(
  source: ExportFileSource,
  jobId: string,
  userId: string,
  res: ExportDownloadResponseLike,
  options: SendReadyExportFileOptions = {},
): void {
  const { buffer, fileName } = source.getReadyFile(jobId, userId);
  const headerName = options.encodeFileName
    ? encodeURIComponent(fileName)
    : fileName;
  res.setHeader('Content-Type', options.contentType ?? XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${headerName}"`);
  res.send(buffer);
}

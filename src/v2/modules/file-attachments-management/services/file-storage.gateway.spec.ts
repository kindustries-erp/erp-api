import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FileStorageGateway } from './file-storage.gateway';
import type { R2Service } from '@/r2/r2.service';

describe('FileStorageGateway', () => {
  const r2 = {
    uploadBuffer: jest.fn(),
    getPresignedDownloadUrl: jest.fn(),
    deleteObject: jest.fn(),
  };
  const gateway = new FileStorageGateway(r2 as unknown as R2Service);

  beforeEach(() => jest.resetAllMocks());

  it('upload chuyển tiếp key, buffer, contentType', async () => {
    const buf = Buffer.from('x');
    await gateway.upload('k', buf, 'application/pdf');
    expect(r2.uploadBuffer).toHaveBeenCalledWith('k', buf, 'application/pdf');
  });

  it('presignDownload trả url và expiresIn', async () => {
    r2.getPresignedDownloadUrl.mockResolvedValue('https://signed');
    await expect(
      gateway.presignDownload('k', 'a.pdf', true, 60),
    ).resolves.toEqual({ url: 'https://signed', expiresIn: 60 });
    expect(r2.getPresignedDownloadUrl).toHaveBeenCalledWith(
      'k',
      60,
      'a.pdf',
      true,
    );
  });

  it('delete chuyển tiếp key', async () => {
    await gateway.delete('k');
    expect(r2.deleteObject).toHaveBeenCalledWith('k');
  });

  it('R2 chưa cấu hình thì 503, không lộ lỗi gốc', async () => {
    r2.uploadBuffer.mockRejectedValue(
      new Error('R2 is not configured on this environment.'),
    );
    await expect(
      gateway.upload('k', Buffer.alloc(0), 'x'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('lỗi R2 khác thì 502 với thông điệp chung', async () => {
    r2.deleteObject.mockRejectedValue(new Error('AccessDenied secret-detail'));
    const err = await gateway.delete('k').catch((e) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect(String(err.message)).not.toContain('secret-detail');
  });
});

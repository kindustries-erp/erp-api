import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  GetObjectCommand,
  PutObjectCommand as PutObjectCmd,
} from '@aws-sdk/client-s3';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
    this.bucket = this.config.getOrThrow<string>('R2_BUCKET_NAME');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * Upload buffer lên R2
   */
  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    this.logger.log(`R2 uploaded: ${key}`);
  }

  /**
   * Download buffer từ R2
   */
  async downloadBuffer(key: string): Promise<Buffer> {
    const s3Obj = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    if (!s3Obj.Body) throw new Error('Empty body');
    const arrayBuffer = await s3Obj.Body.transformToByteArray();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Tạo pre-signed URL để download (GET) — mặc định 1 giờ
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresInSeconds = 3600,
    filename?: string,
  ): Promise<string> {
    const input: any = { Bucket: this.bucket, Key: key };
    if (filename) {
      input.ResponseContentDisposition = `attachment; filename="${filename}"`;
    }
    const cmd = new GetObjectCommand(input);
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  /**
   * Tạo pre-signed URL để upload trực tiếp từ browser (PUT) — mặc định 15 phút
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const cmd = new PutObjectCmd({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  /**
   * Xóa object trên R2
   */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`R2 deleted: ${key}`);
  }
}

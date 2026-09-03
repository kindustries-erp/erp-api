import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { SysFile } from './entities/sys-file.entity';
import { R2Service, resolveS3Endpoint } from '../r2/r2.service';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(SysFile)
    private readonly fileRepo: Repository<SysFile>,
    private readonly r2Service: R2Service,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.getOrThrow<string>('R2_BUCKET_NAME');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: resolveS3Endpoint(this.configService),
      forcePathStyle: Boolean(this.configService.get('R2_ENDPOINT')),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'R2_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async upload(file: Express.Multer.File, userToken: string) {
    try {
      const fileId = randomUUID();
      const filenameDisk = `${fileId}-${file.originalname}`;

      // Upload to R2
      await this.r2Service.uploadBuffer(
        filenameDisk,
        file.buffer,
        file.mimetype,
      );

      // Save metadata to Neon DB
      const sysFile = this.fileRepo.create({
        id: fileId,
        filename_download: file.originalname,
        filename_disk: filenameDisk,
        type: file.mimetype,
        filesize: file.size,
      });

      await this.fileRepo.save(sysFile);

      return { id: sysFile.id };
    } catch (error) {
      this.logger.error('Lỗi khi upload file lên R2', error);
      throw new InternalServerErrorException('Không thể upload file');
    }
  }

  async getFileMeta(id: string): Promise<SysFile> {
    const file = await this.fileRepo.findOneBy({ id });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  async getFileStream(id: string, userToken?: string) {
    const file = await this.getFileMeta(id);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: file.filename_disk,
      });

      const response = await this.s3Client.send(command);

      return {
        stream: response.Body,
        contentType: file.type,
        contentLength: file.filesize,
      };
    } catch (error) {
      this.logger.error(`Lỗi khi lấy file ${id} từ R2`, error);
      throw new InternalServerErrorException('Không thể tải file');
    }
  }
}

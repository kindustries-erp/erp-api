import { randomUUID } from 'crypto';

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ImapFlow } from 'imapflow';
import fetch from 'node-fetch';
import { ParsedMail, simpleParser } from 'mailparser';
import { ILike, Repository } from 'typeorm';

import { R2Service } from '../r2/r2.service';
import { SysFile } from '../files/entities/sys-file.entity';
import { ListEmailIngestDto } from './dto/list-email-ingest.dto';
import { SyncEmailIngestDto } from './dto/sync-email-ingest.dto';
import { ErpEmailAttachment } from './entities/erp_email_attachment.entity';
import { ErpEmailMessage } from './entities/erp_email_message.entity';

type ParsedAddress = {
  name: string | null;
  address: string | null;
};

type EmailAuthMode = 'PASSWORD' | 'OAUTH2';

@Injectable()
export class EmailIngestService {
  private readonly logger = new Logger(EmailIngestService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly r2Service: R2Service,
    @InjectRepository(ErpEmailMessage)
    private readonly messageRepo: Repository<ErpEmailMessage>,
    @InjectRepository(ErpEmailAttachment)
    private readonly attachmentRepo: Repository<ErpEmailAttachment>,
    @InjectRepository(SysFile)
    private readonly sysFileRepo: Repository<SysFile>,
  ) {}

  async listEmails(query: ListEmailIngestDto = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const mailbox = query.mailbox?.trim() || undefined;
    const search = query.search?.trim() || undefined;
    const sort = (query.sort || '-createdAt').trim();

    const qb = this.messageRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.attachments', 'attachment')
      .leftJoinAndSelect('attachment.sysFile', 'sysFile');

    if (mailbox) {
      qb.andWhere('message.mailbox = :mailbox', { mailbox });
    }

    if (search) {
      qb.andWhere(
        '(message.subject ILIKE :search OR message.bodyText ILIKE :search OR message.bodyHtml ILIKE :search OR message.messageId ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const orderDirection = sort.startsWith('-') ? 'DESC' : 'ASC';
    const allowedSortFields = new Set([
      'createdAt',
      'receivedAt',
      'sentAt',
      'ingestedAt',
      'subject',
      'mailbox',
    ]);
    const requestedField = sort.replace(/^-/, '');
    const orderField = allowedSortFields.has(requestedField)
      ? requestedField
      : 'createdAt';

    qb.orderBy(`message.${orderField}`, orderDirection as 'ASC' | 'DESC');
    qb.take(pageSize).skip((page - 1) * pageSize);

    const [items, total] = await qb.distinct(true).getManyAndCount();

    return {
      items: items.map((item) => this.toMessageSummary(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getEmail(id: string) {
    const message = await this.messageRepo.findOne({
      where: { id },
      relations: {
        attachments: {
          sysFile: true,
        },
      },
      order: {
        attachments: {
          attachmentIndex: 'ASC',
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Không tìm thấy email');
    }

    return {
      message: 'Lấy email thành công',
      data: this.toMessageDetail(message),
    };
  }

  async syncMailbox(input: SyncEmailIngestDto = {}) {
    const host = this.configService.get<string>('EMAIL_IMAP_HOST');
    const user = this.configService.get<string>('EMAIL_IMAP_USER');
    const provider = this.configService.get<string>('EMAIL_PROVIDER', 'IMAP');
    const authMode = this.getAuthMode();

    if (!host || !user) {
      throw new InternalServerErrorException(
        'Thiếu cấu hình EMAIL_IMAP_HOST/EMAIL_IMAP_USER',
      );
    }

    const mailbox =
      input.mailbox ??
      this.configService.get<string>('EMAIL_IMAP_MAILBOX') ??
      'INBOX';
    const port = Number(this.configService.get('EMAIL_IMAP_PORT', 993));
    const secure =
      this.configService.get('EMAIL_IMAP_SECURE', 'true') === 'true';
    const tlsRejectUnauthorized =
      this.configService.get('EMAIL_IMAP_TLS_REJECT_UNAUTHORIZED', 'true') ===
      'true';
    const limit =
      input.limit ?? Number(this.configService.get('EMAIL_SYNC_LIMIT', 25));

    const latestPersisted = await this.messageRepo.findOne({
      where: { mailbox },
      order: { createdAt: 'DESC' },
    });

    const startUid =
      input.sinceUid ??
      (latestPersisted?.uid ? Number(latestPersisted.uid) + 1 : 1);

    const auth =
      authMode === 'OAUTH2'
        ? {
            user,
            accessToken: await this.resolveOAuth2AccessToken(),
          }
        : {
            user,
            password: this.configService.get<string>('EMAIL_IMAP_PASS'),
          };

    if (authMode === 'PASSWORD' && !auth.password) {
      throw new InternalServerErrorException(
        'Thiếu cấu hình EMAIL_IMAP_PASS cho chế độ PASSWORD',
      );
    }

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth,
      tls: {
        rejectUnauthorized: tlsRejectUnauthorized,
      },
      logger: false,
    });

    let processed = 0;
    let inserted = 0;
    let skipped = 0;
    let attachmentCount = 0;

    try {
      await client.connect();
      await client.mailboxOpen(mailbox);

      const sequence = `${startUid}:*`;

      for await (const message of client.fetch(sequence, {
        uid: true,
        envelope: true,
        source: true,
        internalDate: true,
      })) {
        processed += 1;

        if (processed > limit) {
          break;
        }

        if (!message.source) {
          skipped += 1;
          continue;
        }

        const parsed = await simpleParser(message.source as Buffer);
        const normalizedMessageId =
          (parsed.messageId || message.envelope?.messageId || null)?.trim() ??
          null;

        if (normalizedMessageId) {
          const existed = await this.messageRepo.findOne({
            where: { messageId: normalizedMessageId, mailbox },
          });
          if (existed) {
            skipped += 1;
            continue;
          }
        }

        const bodyText = parsed.text || null;
        const bodyHtml = typeof parsed.html === 'string' ? parsed.html : null;
        const links = this.extractLinks(bodyText, bodyHtml);

        const savedMessage = await this.messageRepo.save(
          this.messageRepo.create({
            mailbox,
            uid: message.uid ? String(message.uid) : null,
            messageId: normalizedMessageId,
            sourceHost: host,
            sourceProvider: provider,
            subject: parsed.subject || message.envelope?.subject || null,
            fromJson: this.mapAddress(parsed.from?.value),
            toJson: this.mapAddress(parsed.to?.value),
            ccJson: this.mapAddress(parsed.cc?.value),
            bccJson: this.mapAddress(parsed.bcc?.value),
            bodyText,
            bodyHtml,
            headersJson: this.headersToJson(parsed),
            rawMetaJson: {
              inReplyTo: parsed.inReplyTo || null,
              references: parsed.references || [],
              priority: parsed.priority || null,
              attachmentCount: parsed.attachments.length,
              links,
            },
            sentAt: parsed.date ?? null,
            receivedAt: message.internalDate ?? null,
            ingestedAt: new Date(),
          }),
        );

        inserted += 1;

        const attachments = parsed.attachments || [];
        let index = 0;
        for (const attachment of attachments) {
          if (!attachment.content || attachment.content.length === 0) {
            continue;
          }

          const fileId = randomUUID();
          const cleanName = this.sanitizeFileName(
            attachment.filename || `attachment-${index + 1}.bin`,
          );
          const filenameDisk = `${fileId}-${cleanName}`;
          const contentType =
            attachment.contentType || 'application/octet-stream';

          await this.r2Service.uploadBuffer(
            filenameDisk,
            attachment.content,
            contentType,
          );

          const savedSysFile = await this.sysFileRepo.save(
            this.sysFileRepo.create({
              id: fileId,
              filename_download: cleanName,
              filename_disk: filenameDisk,
              type: contentType,
              filesize: attachment.size || attachment.content.length,
            }),
          );

          await this.attachmentRepo.save(
            this.attachmentRepo.create({
              messageId: savedMessage.id,
              sysFileId: savedSysFile.id,
              filename: attachment.filename || null,
              contentType: contentType,
              size: attachment.size || attachment.content.length,
              contentId: attachment.contentId || null,
              disposition: attachment.contentDisposition || null,
              attachmentIndex: index,
              metadataJson: {
                checksum: attachment.checksum,
                related: attachment.related,
                cid: attachment.cid || null,
              },
            }),
          );

          index += 1;
          attachmentCount += 1;
        }
      }

      return {
        message: 'Đồng bộ email thành công',
        data: {
          mailbox,
          host,
          processed,
          inserted,
          skipped,
          attachmentCount,
          startUid,
          limit,
        },
      };
    } catch (error: any) {
      this.logger.error('Lỗi đồng bộ email', error);
      throw new InternalServerErrorException(
        `Không thể đồng bộ email: ${error?.message || 'unknown error'}`,
      );
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private getAuthMode(): EmailAuthMode {
    const raw =
      this.configService.get<string>('EMAIL_IMAP_AUTH_MODE') || 'PASSWORD';
    return raw.toUpperCase() === 'OAUTH2' ? 'OAUTH2' : 'PASSWORD';
  }

  private async resolveOAuth2AccessToken(): Promise<string> {
    const directAccessToken = this.configService.get<string>(
      'EMAIL_IMAP_ACCESS_TOKEN',
    );
    if (directAccessToken) {
      return directAccessToken;
    }

    const refreshToken = this.configService.get<string>(
      'EMAIL_IMAP_REFRESH_TOKEN',
    );
    const clientId = this.configService.get<string>('EMAIL_IMAP_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'EMAIL_IMAP_CLIENT_SECRET',
    );
    const tokenUrl = this.configService.get<string>(
      'EMAIL_IMAP_TOKEN_URL',
      'https://oauth2.googleapis.com/token',
    );

    if (!refreshToken || !clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'Thiếu EMAIL_IMAP_ACCESS_TOKEN hoặc bộ refresh OAuth2 (EMAIL_IMAP_REFRESH_TOKEN/EMAIL_IMAP_CLIENT_ID/EMAIL_IMAP_CLIENT_SECRET)',
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new InternalServerErrorException(
        `Không thể lấy OAuth2 access token: ${response.status} ${text}`,
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!payload.access_token) {
      throw new InternalServerErrorException(
        `Không thể lấy OAuth2 access token: ${payload.error || 'unknown error'} ${payload.error_description || ''}`.trim(),
      );
    }

    return payload.access_token;
  }

  private mapAddress(
    input?: { name?: string; address?: string }[],
  ): ParsedAddress[] {
    if (!input?.length) {
      return [];
    }
    return input.map((item) => ({
      name: item.name || null,
      address: item.address || null,
    }));
  }

  private headersToJson(parsed: ParsedMail) {
    const entries: Array<{ key: string; value: string }> = [];
    for (const [key, value] of parsed.headers) {
      entries.push({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
      });
    }
    return entries;
  }

  private extractLinks(
    bodyText: string | null,
    bodyHtml: string | null,
  ): string[] {
    const source = `${bodyText || ''}\n${bodyHtml || ''}`;
    const regex = /https?:\/\/[^\s"'<>]+/g;
    const matched = source.match(regex) || [];
    return [...new Set(matched)].slice(0, 200);
  }

  private sanitizeFileName(input: string) {
    return input.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  }

  private toMessageSummary(message: ErpEmailMessage) {
    return {
      id: message.id,
      mailbox: message.mailbox,
      uid: message.uid,
      messageId: message.messageId,
      sourceHost: message.sourceHost,
      sourceProvider: message.sourceProvider,
      subject: message.subject,
      fromJson: message.fromJson,
      toJson: message.toJson,
      ccJson: message.ccJson,
      bccJson: message.bccJson,
      sentAt: message.sentAt,
      receivedAt: message.receivedAt,
      ingestedAt: message.ingestedAt,
      attachmentCount: message.attachments?.length ?? 0,
      attachments: (message.attachments || []).map((item) =>
        this.toAttachment(item),
      ),
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      rawMetaJson: message.rawMetaJson,
      headersJson: message.headersJson,
    };
  }

  private toMessageDetail(message: ErpEmailMessage) {
    return {
      ...this.toMessageSummary(message),
      attachments: (message.attachments || []).map((item) =>
        this.toAttachment(item),
      ),
    };
  }

  private toAttachment(item: ErpEmailAttachment) {
    return {
      id: item.id,
      messageId: item.messageId,
      sysFileId: item.sysFileId,
      filename: item.filename,
      contentType: item.contentType,
      size: item.size,
      contentId: item.contentId,
      disposition: item.disposition,
      attachmentIndex: item.attachmentIndex,
      metadataJson: item.metadataJson,
      sysFile: item.sysFile,
    };
  }
}

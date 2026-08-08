import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Subject } from 'rxjs';

import { ErpInvoice } from '../entities/erp_invoice.entity';
import { CompanyProfile } from '../../company-profile/entities/company-profile.entity';
import { ErpBranch } from '../../branches-core/entities/erp_branch.entity';
import { PortalFetchDto } from '../dto/portal-invoice.dto';
import { R2Service } from '../../r2/r2.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import {
  fetchWithRetry,
  resolvePortalVatRate,
  parsePortalIsoDate,
  buildInvoiceR2Key,
  extractXmlFromBuffer,
} from '../helpers/invoice-gdt.helper';
import { sleep } from '../../common/utils/delay.util';
import { extractInvoiceMetadata } from '../helpers/invoice-metadata.helper';
import { resolveOutInvoiceBranchCode } from '../helpers/invoice-branch.helper';
import { classifyInvoiceLine } from '../helpers/out-invoice-display.helper';
import { parseVietnamInvoiceXml } from '../xml-parser/vietnam-invoice-xml.parser';

export type PortalProgressEvent = {
  processId: string;
  type: string;
  total: number;
  current: number;
  message: string;
  completed: boolean;
};

@Injectable()
export class InvoicePortalService {
  private readonly logger = new Logger(InvoicePortalService.name);
  private static readonly GDT_API_BASE_URL =
    'https://hoadondientu.gdt.gov.vn/api';
  private static readonly GDT_PROFILE_URL = `${InvoicePortalService.GDT_API_BASE_URL}/security-taxpayer/profile`;

  public readonly progress$ = new Subject<PortalProgressEvent>();

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    @InjectRepository(CompanyProfile)
    private readonly companyProfileRepo: Repository<CompanyProfile>,
    @InjectRepository(ErpBranch)
    private readonly branchRepository: Repository<ErpBranch>,
    private readonly r2: R2Service,
    private readonly notificationsService: NotificationsService,
    private readonly lifecycleService: InvoiceLifecycleService,
  ) {}

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  private readonly _branchIdCache = new Map<string, string>();

  private async resolveBranchIdForOut(
    settlementOrder: string | null | undefined,
    buyerTaxCode?: string | null,
  ): Promise<string | null> {
    const branchCode = resolveOutInvoiceBranchCode(
      settlementOrder,
      buyerTaxCode,
    );

    if (this._branchIdCache.has(branchCode)) {
      return this._branchIdCache.get(branchCode)!;
    }

    const branch = await this.branchRepository.findOne({
      where: { code: branchCode, isActive: true },
      select: ['id'],
    });

    if (branch) {
      this._branchIdCache.set(branchCode, branch.id);
      return branch.id;
    }

    this.logger.warn(`Branch với code="${branchCode}" không tìm thấy trong DB`);
    return null;
  }

  private async resolveHistoricalBranchForIn(
    sellerTaxCode: string | null,
  ): Promise<string | null> {
    if (!sellerTaxCode) return null;

    const prior = await this.repository.findOne({
      where: {
        direction: 'IN',
        sellerTaxCode,
        branchId: Not(IsNull()),
        isDeleted: false,
      },
      order: { createdAt: 'DESC' },
      select: ['branchId'],
    });

    return prior?.branchId ?? null;
  }

  async getPortalConfig(): Promise<{ token: string; cookies: string }> {
    const profile = await this.companyProfileRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    return {
      token: profile?.gdt_portal_token || '',
      cookies: profile?.gdt_portal_cookies || '',
    };
  }

  async savePortalConfig(token: string, cookies?: string): Promise<void> {
    let profile = await this.companyProfileRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (!profile) {
      profile = this.companyProfileRepo.create({
        company_name: 'Your Company Name',
        gdt_portal_token: token,
        gdt_portal_cookies: cookies,
      });
    } else {
      profile.gdt_portal_token = token;
      if (cookies !== undefined) {
        profile.gdt_portal_cookies = cookies;
      }
    }
    await this.companyProfileRepo.save(profile);
  }

  async checkTokenValid(token: string, cookies?: string): Promise<boolean> {
    if (!token) return false;
    try {
      const url = `${InvoicePortalService.GDT_API_BASE_URL}/query/invoices/purchase?sort=tdlap%3Adesc&size=1`;
      const res = await fetchWithRetry(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(cookies ? { Cookie: cookies } : {}),
        },
      });
      return res.status !== 401 && res.status !== 403;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Portal sync
  // ---------------------------------------------------------------------------

  async syncFromPortal(
    dto: PortalFetchDto,
    userId?: string,
    waitForCompletion = false,
  ) {
    let token = dto.token?.trim();
    let cookies = dto.cookies?.trim();
    if (!token) {
      const config = await this.getPortalConfig();
      token = config.token;
      if (!cookies && config.cookies) cookies = config.cookies;
    }
    if (!token) throw new BadRequestException('token is required');
    await this.validatePortalTaxpayer(token, cookies);
    if (!dto.dateFrom || !dto.dateTo)
      throw new BadRequestException('dateFrom and dateTo are required');

    const type = dto.type ?? 'purchase';
    const direction: 'IN' | 'OUT' = type === 'purchase' ? 'IN' : 'OUT';

    const queryConfigs =
      type === 'purchase'
        ? [
            {
              basePath: `${InvoicePortalService.GDT_API_BASE_URL}/query/invoices/purchase`,
              ttxlyList: [5, 6],
              invoiceType: 'STANDARD',
            },
            {
              basePath: `${InvoicePortalService.GDT_API_BASE_URL}/sco-query/invoices/purchase`,
              ttxlyList: [8],
              invoiceType: 'CASH_REGISTER',
            },
          ]
        : [
            {
              basePath: `${InvoicePortalService.GDT_API_BASE_URL}/query/invoices/sold`,
              ttxlyList: [],
              invoiceType: 'STANDARD',
            },
          ];

    const [fromY, fromM, fromD] = dto.dateFrom.split('-').map(Number);
    const startDate = new Date(fromY, fromM - 1, fromD);
    const [toY, toM, toD] = dto.dateTo.split('-').map(Number);
    const endDate = new Date(toY, toM - 1, toD);

    const task = async () => {
      try {
        const rawItems: any[] = [];
        let totalFromPortal = 0;
        let pagesFetched = 0;
        const maxPages = 50;
        let isFirstRequest = true;

        for (
          let d = new Date(startDate);
          d <= endDate;
          d.setDate(d.getDate() + 1)
        ) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const formattedDate = `${day}/${m}/${y}`;

          for (const cfg of queryConfigs) {
            const loopTtxlys =
              cfg.ttxlyList.length > 0 ? cfg.ttxlyList : [null];

            for (const currentTtxly of loopTtxlys) {
              let state: string | null = null;
              let pathPagesFetched = 0;

              do {
                const url = new URL(cfg.basePath);
                url.searchParams.set('sort', 'tdlap:desc');
                url.searchParams.set('size', '50');
                let searchStr = `tdlap=ge=${formattedDate}T00:00:00;tdlap=le=${formattedDate}T23:59:59`;
                if (currentTtxly !== null)
                  searchStr += `;ttxly==${currentTtxly}`;
                url.searchParams.set('search', searchStr);
                if (state) url.searchParams.set('state', state);

                this.progress$.next({
                  processId: 'sync-progress',
                  type: 'bulk',
                  total: 100,
                  current: pagesFetched,
                  message: `Đang lấy danh sách hóa đơn từ cơ quan thuế (ngày ${formattedDate}, trang ${pagesFetched + 1})...`,
                  completed: false,
                });

                if (!isFirstRequest) {
                  const delay = (4 + Math.random() * 3) * 1000;
                  await sleep(Math.round(delay));
                }
                isFirstRequest = false;

                const fetchHeaders: Record<string, string> = {
                  Authorization: `Bearer ${token}`,
                };
                if (cookies) fetchHeaders['Cookie'] = cookies;

                const response = await fetchWithRetry(url, {
                  headers: fetchHeaders,
                });
                if (!response.ok)
                  throw new BadRequestException(
                    `Portal request failed with status ${response.status}`,
                  );

                const payload = (await response.json()) as {
                  datas?: any[];
                  total?: number;
                  state?: string;
                };

                if (pathPagesFetched === 0) {
                  totalFromPortal += payload.total ?? 0;
                }

                if (payload.datas && payload.datas.length > 0) {
                  rawItems.push(
                    ...payload.datas.map((d: any) => ({
                      ...d,
                      __taxInvoiceType: cfg.invoiceType,
                    })),
                  );
                }

                state = payload.state ?? null;
                pathPagesFetched++;
                pagesFetched++;
              } while (state && pathPagesFetched < maxPages);
            }
          }
        }

        // Save to DB
        let created = 0;
        let skipped = 0;
        const errors: string[] = [];
        const backgroundSyncIds: string[] = [];

        for (const raw of rawItems) {
          try {
            const invoiceNo = String(raw.shdon ?? '');
            const serialNo = raw.khhdon ?? null;
            const taxInvoiceStatus =
              raw.tthai !== undefined && raw.tthai !== null
                ? Number(raw.tthai)
                : null;
            const taxProcessStatus =
              raw.ttxly !== undefined && raw.ttxly !== null
                ? Number(raw.ttxly)
                : null;
            const taxInvoiceType = raw.__taxInvoiceType || 'STANDARD';

            const existing = await this.repository.findOne({
              where: { invoiceNo, serialNo, direction, isDeleted: false },
            });

            if (existing) {
              let updated = false;
              if (existing.taxInvoiceStatus !== taxInvoiceStatus) {
                existing.taxInvoiceStatus = taxInvoiceStatus;
                updated = true;
              }
              if (existing.taxProcessStatus !== taxProcessStatus) {
                existing.taxProcessStatus = taxProcessStatus;
                updated = true;
              }
              if (existing.taxInvoiceType !== taxInvoiceType) {
                existing.taxInvoiceType = taxInvoiceType;
                updated = true;
              }
              if (updated) await this.repository.save(existing);
              if (!existing.xmlFileKey || !existing.description)
                backgroundSyncIds.push(existing.id);
              skipped++;
              continue;
            }

            const vatRate = resolvePortalVatRate(raw);
            const invoice = this.repository.create({
              invoiceNo,
              serialNo,
              invoiceDate: parsePortalIsoDate(raw.tdlap),
              direction,
              status: 'CONFIRMED',
              taxInvoiceStatus,
              taxProcessStatus,
              taxInvoiceType,
              sellerTaxCode: raw.nbmst ?? null,
              sellerName: raw.nbten ?? null,
              sellerAddress: raw.nbdchi ?? null,
              buyerTaxCode: raw.nmmst ?? raw.mst ?? null,
              buyerName: raw.nmten ?? null,
              buyerAddress: raw.nmdchi ?? null,
              buyerPersonalName: raw.nmtnmua ?? null,
              buyerCccd: raw.nmcmnd ?? null,
              invoiceType: raw.thdon ?? null,
              preVatAmount: String(raw.tgtcthue ?? 0),
              vatRate,
              vatAmount: String(raw.tgtthue ?? 0),
              discountAmount: String(raw.ttcktmai ?? 0),
              totalAmount: String(raw.tgtttbso ?? 0),
              source: 'PORTAL',
              externalId: `${serialNo}_${invoiceNo}`,
            } as any);

            extractInvoiceMetadata(invoice);

            const saved = (await this.repository.save(
              invoice,
            )) as unknown as ErpInvoice;

            if (direction === 'OUT') {
              const branchId = await this.resolveBranchIdForOut(
                saved.settlementOrder,
                saved.buyerTaxCode,
              );
              if (branchId) {
                await this.repository.update(saved.id, { branchId });
              }
            }

            if (direction === 'IN') {
              const branchId = await this.resolveHistoricalBranchForIn(
                saved.sellerTaxCode,
              );
              if (branchId) {
                await this.repository.update(saved.id, { branchId });
              }
            }

            backgroundSyncIds.push(saved.id);
            created++;
          } catch (err) {
            errors.push((err as Error).message);
          }
        }

        this.progress$.next({
          processId: 'sync-progress',
          type: 'bulk',
          total: rawItems.length,
          current: rawItems.length,
          message: `Đã lấy xong ${rawItems.length} hóa đơn. Đang chuyển sang tải chi tiết...`,
          completed: false,
        });

        if (backgroundSyncIds.length > 0) {
          this.downloadXmlsInBackground(
            backgroundSyncIds,
            token,
            cookies,
          ).catch((e) =>
            this.logger.error('XML background download failed', e),
          );
        }

        this.logger.log(
          `Background portal sync completed. Fetched: ${rawItems.length}, Imported: ${created}, Skipped: ${skipped}`,
        );
        if (errors.length > 0) {
          this.logger.error(
            `Sync errors (${errors.length}): ${errors.slice(0, 5).join(', ')}`,
          );
        }

        return {
          totalItemsFetched: rawItems.length,
          totalFromPortal,
          pagesFetched,
          imported: created,
          skipped,
          direction,
          errors,
          xmlDownloadQueued: backgroundSyncIds.length,
        };
      } catch (err) {
        this.logger.error('Background portal sync failed', err);
        if (userId) {
          await this.notificationsService.createForUser(userId, {
            title: 'Lỗi đồng bộ hóa đơn',
            message: `Tiến trình đồng bộ hóa đơn bị lỗi: ${(err as Error).message}`,
            type: 'ERROR',
          });
        }
        throw err;
      }
    };

    if (waitForCompletion) {
      return await task();
    }

    // Fire-and-forget
    task().catch(() => {});

    return {
      totalItemsFetched: 0,
      totalFromPortal: 0,
      pagesFetched: 0,
      imported: 0,
      skipped: 0,
      direction,
      errors: [],
      xmlDownloadQueued: 0,
      note: 'Tiến trình đồng bộ đang chạy ngầm trên máy chủ. Vui lòng chờ ít phút.',
    };
  }

  // ---------------------------------------------------------------------------
  // Single invoice — reparse XML
  // ---------------------------------------------------------------------------

  async reparseXml(
    id: string,
    token?: string,
    cookies?: string,
  ): Promise<ErpInvoice> {
    let activeToken = token?.trim();
    let activeCookies = cookies?.trim();
    if (!activeToken) {
      const cfg = await this.getPortalConfig();
      activeToken = cfg.token;
      if (!activeCookies) activeCookies = cfg.cookies;
    }
    const invoiceResp = await this.lifecycleService.findOne(id);
    let invoice = invoiceResp.data;

    if (!invoice.xmlFileKey) {
      if (!activeToken) {
        throw new BadRequestException(
          'Hóa đơn này chưa có file XML đính kèm và không có token portal để tự tải.',
        );
      }
      await this.downloadAndSaveXml(invoice as any, activeToken, activeCookies);
      const updatedResp = await this.lifecycleService.findOne(id);
      invoice = updatedResp.data;
      if (!invoice.xmlFileKey) {
        throw new BadRequestException(
          'Không thể tải XML từ GDT. Vui lòng kiểm tra lại token hoặc trạng thái hóa đơn.',
        );
      }
    }

    try {
      const xmlBuffer = await this.r2.downloadBuffer(invoice.xmlFileKey);
      const { xmlString } = extractXmlFromBuffer(xmlBuffer);

      if (!xmlString) {
        throw new BadRequestException(
          'Không tìm thấy nội dung XML hợp lệ trong file đính kèm.',
        );
      }

      const parsedXml = parseVietnamInvoiceXml(xmlString);

      await this.lifecycleService.update(invoice.id, {
        preVatAmount: parsedXml.preVatAmount,
        vatRate: parsedXml.vatRate ?? undefined,
        vatAmount: parsedXml.vatAmount,
        discountAmount: parsedXml.discountAmount,
        totalAmount: parsedXml.totalAmount,
        sellerName: parsedXml.sellerName ?? undefined,
        sellerAddress: parsedXml.sellerAddress ?? undefined,
        buyerName: parsedXml.buyerName ?? undefined,
        buyerAddress: parsedXml.buyerAddress ?? undefined,
        buyerPersonalName: parsedXml.buyerPersonalName ?? undefined,
        buyerCccd: parsedXml.buyerCccd ?? undefined,
        buyerTaxCode: parsedXml.buyerTaxCode ?? undefined,
        description: parsedXml.description ?? undefined,
        items: parsedXml.items.map((i) => ({
          ...i,
          unit: i.unit ?? undefined,
          quantity: i.quantity ?? undefined,
          unitPrice: i.unitPrice ?? undefined,
          vatRate: i.vatRate ?? undefined,
        })),
      });

      return (await this.lifecycleService.findOne(id)).data as ErpInvoice;
    } catch (e) {
      this.logger.error(
        `Failed to reparse XML for ${id}: ${(e as Error).message}`,
      );
      throw new BadRequestException(
        `Không thể đồng bộ: ${(e as Error).message}`,
      );
    }
  }

  async bulkDownloadXml(
    token: string | undefined,
    cookies: string | undefined,
    direction: 'IN' | 'OUT',
  ) {
    let activeToken = token?.trim();
    let activeCookies = cookies?.trim();
    if (!activeToken) {
      const cfg = await this.getPortalConfig();
      activeToken = cfg.token;
      if (!activeCookies) activeCookies = cfg.cookies;
    }
    if (!activeToken) throw new BadRequestException('token is required');
    if (!token) throw new BadRequestException('Token portal là bắt buộc.');

    const invoices = await this.repository.find({
      where: [
        { source: 'PORTAL', direction, xmlFileKey: IsNull(), isDeleted: false },
        {
          source: 'PORTAL',
          direction,
          description: IsNull(),
          isDeleted: false,
        },
      ],
    });

    const total = invoices.length;
    if (total === 0) {
      return {
        message: 'Không có hóa đơn nào thiếu XML hoặc Diễn giải cần tải lại.',
        count: 0,
      };
    }

    const processId = 'sync-progress';

    (async () => {
      this.logger.log(`Bắt đầu tải nền XML cho ${total} hóa đơn`);
      this.progress$.next({
        processId,
        type: 'bulk',
        total,
        current: 0,
        message: `Đang tải chi tiết & XML hàng loạt (0/${total})...`,
        completed: false,
      });

      let current = 0;
      for (const inv of invoices) {
        try {
          await this.downloadAndSaveXml(inv as any, activeToken, activeCookies);
          current++;
          this.progress$.next({
            processId,
            type: 'bulk',
            total,
            current,
            message: `Đang tải chi tiết & XML hàng loạt (${current}/${total})...`,
            completed: false,
          });
          await new Promise((r) => setTimeout(r, 500));
        } catch (e) {
          this.logger.warn(
            `Lỗi tải XML cho ${inv.invoiceNo}: ${(e as Error).message}`,
          );
        }
      }

      this.progress$.next({
        processId,
        type: 'bulk',
        total,
        current,
        message: `Đã hoàn tất tải hàng loạt ${total} hóa đơn!`,
        completed: true,
      });
      this.logger.log(`Hoàn thành tải nền XML cho ${total} hóa đơn`);
    })().catch((err) => {
      this.logger.error('Lỗi khi chạy background bulk download', err);
    });

    return {
      message: `Đang tải lại XML ngầm cho ${invoices.length} hóa đơn. Vui lòng chờ ít phút.`,
      count: invoices.length,
    };
  }

  async syncDetailFromPortal(
    id: string,
    token?: string,
    cookies?: string,
  ): Promise<ErpInvoice> {
    let activeToken = token?.trim();
    let activeCookies = cookies?.trim();
    if (!activeToken) {
      const cfg = await this.getPortalConfig();
      activeToken = cfg.token;
      if (!activeCookies) activeCookies = cfg.cookies;
    }
    if (!activeToken)
      throw new BadRequestException('Token portal là bắt buộc.');

    const invoiceResp = await this.lifecycleService.findOne(id);
    const invoice = invoiceResp.data as any;
    await this.syncInvoiceDetailFromJson(invoice, activeToken, activeCookies);
    return (await this.lifecycleService.findOne(id)).data as ErpInvoice;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async downloadXmlsInBackground(
    invoiceIds: string[],
    token: string,
    cookies?: string,
  ): Promise<void> {
    const processId = 'sync-progress';
    const invoices = await this.repository.findByIds(invoiceIds);
    const targets = invoices.filter(
      (inv) => !inv.xmlFileKey || !inv.description,
    );

    const total = targets.length;
    if (total === 0) return;

    this.progress$.next({
      processId,
      type: 'sync',
      total,
      current: 0,
      message: `Đang tải chi tiết & XML (0/${total})...`,
      completed: false,
    });

    let current = 0;
    for (let i = 0; i < targets.length; i++) {
      const inv = targets[i];
      await this.downloadAndSaveXml(inv, token, cookies).catch((e) =>
        this.logger.error(`Error downloading XML for ${inv.invoiceNo}:`, e),
      );
      current++;
      this.progress$.next({
        processId,
        type: 'sync',
        total,
        current,
        message: `Đang tải chi tiết & XML (${current}/${total})...`,
        completed: false,
      });
      if (i + 1 < targets.length) {
        const delay = (4 + Math.random() * 3) * 1000;
        await sleep(Math.round(delay));
      }
    }

    this.progress$.next({
      processId,
      type: 'sync',
      total,
      current,
      message: `Đã hoàn tất tải ${total} hóa đơn!`,
      completed: true,
    });
    this.logger.log(`XML download complete: ${targets.length} files processed`);
  }

  async downloadAndSaveXml(
    invoice: ErpInvoice,
    token: string,
    cookies?: string,
  ): Promise<void> {
    await this.syncInvoiceDetailFromJson(invoice, token, cookies);

    if (invoice.direction === 'OUT') {
      const updated = await this.repository.findOne({
        where: { id: invoice.id },
        select: ['id', 'settlementOrder', 'branchId'],
      });
      if (updated) {
        const newBranchId = await this.resolveBranchIdForOut(
          updated.settlementOrder,
          updated.buyerTaxCode,
        );
        if (newBranchId && updated.branchId !== newBranchId) {
          await this.repository.update(invoice.id, { branchId: newBranchId });
          this.logger.log(
            `Branch updated for invoice ${invoice.invoiceNo}: ${updated.branchId} -> ${newBranchId}`,
          );
        }
      }
    }

    await sleep(2000);

    try {
      let endpoints: string[] = [];
      if (invoice.taxInvoiceType === 'CASH_REGISTER') {
        endpoints = ['sco-query'];
      } else if (invoice.taxInvoiceType === 'STANDARD') {
        endpoints = ['query'];
      } else {
        endpoints = ['query', 'sco-query'];
      }

      const fetchHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (cookies) fetchHeaders['Cookie'] = cookies;

      let res: Response | null = null;
      for (let i = 0; i < endpoints.length; i++) {
        const ep = endpoints[i];
        const url = new URL(
          `${InvoicePortalService.GDT_API_BASE_URL}/${ep}/invoices/export-xml`,
        );
        url.searchParams.set('nbmst', invoice.sellerTaxCode ?? '');
        url.searchParams.set('khhdon', invoice.serialNo ?? '');
        url.searchParams.set('shdon', invoice.invoiceNo);
        url.searchParams.set('khmshdon', '1');

        res = await fetchWithRetry(
          url.toString(),
          { headers: fetchHeaders },
          i === endpoints.length - 1 ? 2 : 0,
        );
        if (res.ok) break;
      }

      if (!res || !res.ok) {
        this.logger.warn(
          `XML download failed for invoice ${invoice.invoiceNo}: HTTP ${res?.status ?? 'Unknown'}`,
        );
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const xmlBuffer = Buffer.from(arrayBuffer);
      const isZip =
        xmlBuffer.length > 4 && xmlBuffer[0] === 0x50 && xmlBuffer[1] === 0x4b;
      const ext = isZip ? 'zip' : 'xml';
      const contentType = isZip ? 'application/zip' : 'application/xml';

      const mst =
        invoice.direction === 'IN'
          ? invoice.sellerTaxCode
          : invoice.buyerTaxCode;
      const xmlKey = buildInvoiceR2Key({
        direction: invoice.direction,
        invoiceDate: invoice.invoiceDate,
        taxCode: mst,
        serialNo: invoice.serialNo,
        invoiceNo: invoice.invoiceNo,
        ext,
      });

      const { xmlString } = extractXmlFromBuffer(xmlBuffer);

      await this.r2.uploadBuffer(xmlKey, xmlBuffer, contentType);

      const updateData: any = { xmlFileKey: xmlKey };

      await this.repository.update(invoice.id, updateData);
      this.logger.log(`XML saved for invoice ${invoice.invoiceNo}: ${xmlKey}`);
    } catch (err) {
      this.logger.warn(
        `downloadAndSaveXml error for ${invoice.invoiceNo}: ${(err as Error).message}`,
      );
    }
  }

  async syncInvoiceDetailFromJson(
    invoice: ErpInvoice,
    token: string,
    cookies?: string,
  ): Promise<string | undefined> {
    try {
      let endpoints: string[] = [];
      if (invoice.taxInvoiceType === 'CASH_REGISTER') {
        endpoints = ['sco-query'];
      } else if (invoice.taxInvoiceType === 'STANDARD') {
        endpoints = ['query'];
      } else {
        endpoints = ['query', 'sco-query'];
      }

      const fetchHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (cookies) fetchHeaders['Cookie'] = cookies;

      let res: Response | null = null;
      for (let i = 0; i < endpoints.length; i++) {
        const ep = endpoints[i];
        const url = new URL(
          `${InvoicePortalService.GDT_API_BASE_URL}/${ep}/invoices/detail`,
        );
        url.searchParams.set('nbmst', invoice.sellerTaxCode ?? '');
        url.searchParams.set('khhdon', invoice.serialNo ?? '');
        url.searchParams.set('shdon', invoice.invoiceNo);
        url.searchParams.set('khmshdon', '1');

        res = await fetchWithRetry(
          url.toString(),
          { headers: fetchHeaders },
          i === endpoints.length - 1 ? 2 : 0,
        );
        if (res.ok) break;
      }

      if (!res || !res.ok) {
        this.logger.warn(
          `Failed to fetch JSON detail for ${invoice.invoiceNo}: HTTP ${res?.status ?? 'Unknown'}`,
        );
        return;
      }

      const json = await res.json();

      const items = (json.hdhhdvu || []).map((i: any) => ({
        description: i.ten,
        unit: i.dvtinh,
        quantity: i.sluong != null ? Number(i.sluong) : undefined,
        unitPrice: i.dgia != null ? Number(i.dgia) : undefined,
        preVatAmount: i.thtien != null ? Number(i.thtien) : 0,
        vatRate:
          i.tsuat != null
            ? typeof i.tsuat === 'string'
              ? parseFloat(i.tsuat)
              : Number(i.tsuat)
            : undefined,
        vatAmount: i.tthue != null ? Number(i.tthue) : 0,
        discountAmount: i.stckhau != null ? Number(i.stckhau) : 0,
      }));

      const invoiceLineCount = items.length;

      const normalizedItems = items.map((item: any) => {
        const classification = classifyInvoiceLine(item, {
          buyerTaxCode: invoice.buyerTaxCode,
          direction: invoice.direction,
          invoiceLineCount,
          taxInvoiceStatus: invoice.taxInvoiceStatus,
          headerDiscountAmount:
            json.ttcktmai != null ? Number(json.ttcktmai) : 0,
        });
        return {
          ...item,
          ...classification,
        };
      });

      await this.lifecycleService.update(invoice.id, {
        preVatAmount: json.tgtcthue != null ? Number(json.tgtcthue) : undefined,
        vatAmount: json.tgtthue != null ? Number(json.tgtthue) : undefined,
        discountAmount:
          json.ttcktmai != null ? Number(json.ttcktmai) : undefined,
        totalAmount: json.tgtttbso != null ? Number(json.tgtttbso) : undefined,
        sellerName: json.nbten,
        sellerAddress: json.nbdchi,
        buyerName: json.nmten,
        buyerAddress: json.nmdchi,
        buyerPersonalName: json.nmtnmua,
        buyerCccd: json.nmcmnd,
        buyerTaxCode: json.mst,
        description: items.length > 0 ? items[0].description : undefined,
        items: normalizedItems,
      });

      this.logger.log(
        `Invoice details synced from JSON for ${invoice.invoiceNo}`,
      );
      return json.id || json.tgmtt;
    } catch (err) {
      this.logger.warn(
        `syncInvoiceDetailFromJson error for ${invoice.invoiceNo}: ${(err as Error).message}`,
      );
      return undefined;
    }
  }

  private normalizeTaxCode(value?: string | null): string | null {
    if (!value) return null;
    const normalized = String(value)
      .replace(/[^0-9A-Za-z]/g, '')
      .toUpperCase();
    return normalized || null;
  }

  private collectProfileTaxCodes(profile: any): string[] {
    const bag = new Set<string>();
    const add = (val?: string | null) => {
      const normalized = this.normalizeTaxCode(val);
      if (normalized) bag.add(normalized);
    };

    add(profile?.username);
    add(profile?.id);
    add(profile?.groupId);
    add(profile?.tinInfoTT86?.mst);
    add(profile?.tinInfoTT86?.mstUTien);

    const groupIds = profile?.groupIds;
    if (typeof groupIds === 'string') {
      groupIds
        .split(/[;,\s]+/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .forEach((s: string) => add(s));
    }

    if (Array.isArray(groupIds)) {
      groupIds.forEach((s: any) => add(String(s ?? '')));
    }

    if (Array.isArray(profile?.tinInfoTT86?.dsMst)) {
      profile.tinInfoTT86.dsMst.forEach((s: any) => add(String(s ?? '')));
    }

    return [...bag];
  }

  private async validatePortalTaxpayer(
    token: string,
    cookies?: string,
  ): Promise<void> {
    const profile = await this.companyProfileRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });

    const expectedTaxCode = this.normalizeTaxCode(profile?.tax_code);
    if (!expectedTaxCode) {
      throw new BadRequestException('GDT_COMPANY_TAX_CODE_NOT_CONFIGURED');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (cookies) headers.Cookie = cookies;

    const response = await fetchWithRetry(
      InvoicePortalService.GDT_PROFILE_URL,
      {
        headers,
      },
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('GDT_TOKEN_EXPIRED');
      }
      throw new BadRequestException('GDT_PROFILE_FETCH_FAILED');
    }

    const taxpayerProfile = await response.json();
    const actualTaxCodes = this.collectProfileTaxCodes(taxpayerProfile);

    if (actualTaxCodes.length === 0) {
      throw new BadRequestException('GDT_PROFILE_MISSING_TAX_CODE');
    }

    if (!actualTaxCodes.includes(expectedTaxCode)) {
      this.logger.warn(
        `GDT taxpayer mismatch. expected=${expectedTaxCode} actual=${actualTaxCodes.join(',')}`,
      );
      throw new BadRequestException('GDT_TAXPAYER_MISMATCH');
    }
  }
}

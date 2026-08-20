import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraClientService } from './kgara-client.service';
import { KgaraReceivable } from './entities/kgara_receivable.entity';
import { KgaraPayable } from './entities/kgara_payable.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { GwSyncRun, GwSyncStatus } from './entities/kgara_sync_run.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from './entities/kgara_case_linked_invoice.entity';
import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Safely parse date from various formats without producing Invalid Date / NaN
 */
export function parseSafeDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      !trimmed ||
      trimmed === 'null' ||
      trimmed === 'undefined' ||
      trimmed.includes('NaN') ||
      trimmed.startsWith('0001-01-01') ||
      trimmed.startsWith('1900-01-01')
    ) {
      return null;
    }
    // Check if DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
    );
    if (dmyMatch) {
      const [, d, m, y, hh, mm, ss] = dmyMatch;
      const isoFormatted = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${
        hh
          ? `T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${(ss || '00').padStart(2, '0')}`
          : 'T00:00:00'
      }`;
      const parsed = new Date(isoFormatted);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

@Injectable()
export class KgaraSyncService {
  private readonly logger = new Logger(KgaraSyncService.name);

  constructor(
    @InjectRepository(KgaraBranch)
    private branchRepo: Repository<KgaraBranch>,
    @InjectRepository(KgaraCase)
    private caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraReceivable)
    private receivableRepo: Repository<KgaraReceivable>,
    @InjectRepository(KgaraPayable)
    private payableRepo: Repository<KgaraPayable>,
    @InjectRepository(KgaraCaseService)
    private caseServiceRepo: Repository<KgaraCaseService>,
    @InjectRepository(GwSyncRun)
    private syncRunRepo: Repository<GwSyncRun>,
    @InjectRepository(KgaraGrossProfit)
    private grossProfitRepo: Repository<KgaraGrossProfit>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
    @InjectRepository(KgaraCaseSettlement)
    private settlementRepo: Repository<KgaraCaseSettlement>,
    private client: KgaraClientService,
    private notificationsService: NotificationsService,
  ) {}

  private async createSyncRun(
    branchId: string | null,
    endpoint: string,
    queryParams: any,
    pageSize: number,
  ): Promise<GwSyncRun> {
    const run = new GwSyncRun();
    run.branchExternalId = branchId;
    run.endpoint = endpoint;
    run.queryParams = queryParams;
    run.pageSize = pageSize;
    run.requestStartedAt = new Date();
    return this.syncRunRepo.save(run);
  }

  private async closeSyncRun(
    run: GwSyncRun,
    status: GwSyncStatus,
    rowCount: number,
    errorMsg?: string,
    responseStatus?: number,
    dataAsOf?: string,
  ) {
    run.requestEndedAt = new Date();
    run.status = status;
    run.rowCount = rowCount;
    if (errorMsg) run.errorMessage = errorMsg;
    if (responseStatus) run.responseStatus = responseStatus;
    if (dataAsOf) run.dataAsOf = parseSafeDate(dataAsOf);
    await this.syncRunRepo.save(run);
  }

  async syncBranches(): Promise<void> {
    this.logger.log('Syncing Kgara branches...');
    const run = await this.createSyncRun(null, '/api/v1/donvi/list', {}, 0);
    try {
      const branches = await this.client.getBranches();
      for (const b of branches) {
        let branch = await this.branchRepo.findOne({
          where: { externalId: b.DonViID },
        });
        if (!branch) {
          branch = new KgaraBranch();
          branch.externalId = b.DonViID;
        }
        branch.code = b.MaSo;
        branch.name = b.TenDonVi;
        branch.parentId = b.ParentID || null;
        await this.branchRepo.save(branch);
      }
      await this.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        branches.length,
        undefined,
        200,
      );
      this.logger.log('Finished syncing branches.');
    } catch (error: any) {
      await this.closeSyncRun(run, GwSyncStatus.FAILED, 0, error.message);
      throw error;
    }
  }

  async syncCasesForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    this.logger.log(`Syncing cases for branch ${branchExternalId}...`);
    let page = 1;
    let totalPages = 1;
    let totalRows = 0;

    // We record the start time before we make the first request
    // This will be used as the watermark for the next incremental sync
    const syncStartedAt = new Date().toISOString();
    const run = await this.createSyncRun(
      branchExternalId,
      '/api/v1/gr/cases/list',
      { from, to, updatedSince },
      200,
    );

    try {
      const updatedCaseDates = new Set<string>();
      const syncedIds = new Set<string>();
      do {
        const response = await this.client.getCases(
          branchExternalId,
          from,
          to,
          updatedSince,
          page,
          200,
        );
        const cases = response?.data || [];
        totalPages = response?.pagination?.totalPages || 1;
        const dataAsOf = response?.dataAsOf;

        for (const c of cases) {
          let gwCase = await this.caseRepo.findOne({
            where: { hdPhieuDichVuId: c.HdPhieuDichVuID },
          });
          if (!gwCase) {
            gwCase = new KgaraCase();
            gwCase.hdPhieuDichVuId = c.HdPhieuDichVuID;
          }

          syncedIds.add(c.HdPhieuDichVuID);

          // State transitions handling
          const previousStatus = gwCase.tinhTrangDichVu;
          const newStatus = c.TinhTrangDichVu;

          // Typed mappings - ERP fields are explicitly omitted (not overwritten)
          gwCase.soChungTu = c.SoChungTu;
          gwCase.bienSoXe = c.BienSoXe;
          gwCase.khachHangCode = c.KhachHangCode;
          gwCase.khachHangName = c.KhachHangName || c.TenKhachHang;
          gwCase.tinhTrangDichVu = newStatus;
          gwCase.tenTinhTrangDichVu = c.TenTinhTrangDichVu;
          gwCase.tienCoThue = c.TienCoThue;
          gwCase.tienDaThanhToan = c.TienDaThanhToan;
          gwCase.tienConPhaiThanhToan = c.TienConPhaiThanhToan;

          if (gwCase.id) {
            const existingSettlements = await this.settlementRepo.find({
              where: { caseId: gwCase.id },
            });
            if (existingSettlements.length > 0) {
              const totalReceipts = existingSettlements
                .filter((s) => s.settlementType === 'RECEIPT')
                .reduce((sum, s) => sum + Number(s.amount || 0), 0);
              const targetRevenue = Number(c.TienCoThue ?? c.DoanhThu ?? 0);
              gwCase.tienDaThanhToan = totalReceipts;
              gwCase.tienConPhaiThanhToan = Math.max(
                0,
                targetRevenue - totalReceipts,
              );
            }
          }

          if (newStatus === 9) {
            // Cancelled: Clear gross profit
            gwCase.doanhThu = 0;
            gwCase.chiPhi = 0;
            gwCase.loiNhuan = 0;
            await this.grossProfitRepo.delete({
              hdPhieuDichVuId: c.HdPhieuDichVuID,
            });

            if (gwCase.id) {
              const hasInvoices = await this.linkedInvoiceRepo.count({
                where: { caseDbId: gwCase.id },
              });
              const hasSettlements = await this.settlementRepo.count({
                where: { caseId: gwCase.id },
              });
              if (hasInvoices > 0 || hasSettlements > 0) {
                this.logger.warn(
                  `ALERT: Cancelled case ${gwCase.soChungTu || gwCase.hdPhieuDichVuId} has active linked invoices (${hasInvoices}) or settlements (${hasSettlements})!`,
                );
              }
            }
          } else if (previousStatus === 3 && newStatus !== 3) {
            // Reverted from Completed (3) to In-progress: Reset GP
            gwCase.doanhThu = null;
            gwCase.chiPhi = null;
            gwCase.loiNhuan = null;
            await this.grossProfitRepo.delete({
              hdPhieuDichVuId: c.HdPhieuDichVuID,
            });
            this.logger.log(
              `Case ${gwCase.soChungTu || gwCase.hdPhieuDichVuId} reverted from Completed (3) to In-Progress (${newStatus}). Gross profit reset.`,
            );
          } else if (newStatus === 3) {
            // Only completed status has Gross Profit
            if (c.DoanhThu !== undefined) gwCase.doanhThu = c.DoanhThu;
            if (c.ChiPhi !== undefined) gwCase.chiPhi = c.ChiPhi;
            if (c.LoiNhuan !== undefined) gwCase.loiNhuan = c.LoiNhuan;
          } else {
            // Non-completed status: Do not retain gross profit
            gwCase.doanhThu = null;
            gwCase.chiPhi = null;
            gwCase.loiNhuan = null;
          }
          gwCase.ngayPhatSinh =
            parseSafeDate(c.NgayPhatSinhFull) || parseSafeDate(c.NgayPhatSinh);
          gwCase.ngayTiepNhan = parseSafeDate(c.NgayTiepNhan);
          gwCase.ngayHoanThanhCongViec = parseSafeDate(c.NgayHoanThanhCongViec);
          gwCase.ngayGiaoXeFull = parseSafeDate(c.NgayGiaoXeFull);
          gwCase.soKhung = c.SoKhung;
          gwCase.dataAsOf = parseSafeDate(dataAsOf);

          const caseDate =
            gwCase.ngayHoanThanhCongViec ||
            gwCase.ngayPhatSinh ||
            gwCase.ngayTiepNhan;
          if (caseDate && !isNaN(caseDate.getTime())) {
            updatedCaseDates.add(caseDate.toISOString());
          }

          gwCase.branchExternalId = branchExternalId;
          gwCase.rawData = c;

          // Restore case if it was previously soft-deleted
          if (gwCase.kgaraDeletedAt) {
            gwCase.kgaraDeletedAt = null;
            gwCase.kgaraDeleteCount = 0;
            this.logger.log(
              `Case ${gwCase.hdPhieuDichVuId} was restored from soft-delete.`,
            );
          }

          await this.caseRepo.save(gwCase);
          totalRows++;

          // Optionally, auto fetch detail for newly changed cases if desired.
          // For now, we rely on a separate job or client request to fetch detail.
        }
        page++;
      } while (page <= totalPages);

      // Sync gross profit details to map financial data to cases
      try {
        const dateRangesToSync: { from: string; to: string }[] = [];

        const parsedFrom = parseSafeDate(from);
        const parsedTo = parseSafeDate(to);

        if (parsedFrom && parsedTo) {
          dateRangesToSync.push({
            from: parsedFrom.toISOString().split('T')[0],
            to: parsedTo.toISOString().split('T')[0],
          });
        } else {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          dateRangesToSync.push({
            from: firstDay.toLocaleDateString('en-CA'),
            to: lastDay.toLocaleDateString('en-CA'),
          });

          const monthsToSync = new Set<string>();
          for (const isoStr of updatedCaseDates) {
            const d = parseSafeDate(isoStr);
            if (d && (d < firstDay || d > lastDay)) {
              monthsToSync.add(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
              );
            }
          }

          for (const yyyyMm of monthsToSync) {
            const [y, m] = yyyyMm.split('-');
            const fd = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
              'en-CA',
            );
            const ld = new Date(Number(y), Number(m), 0).toLocaleDateString(
              'en-CA',
            );
            dateRangesToSync.push({ from: fd, to: ld });
          }
        }

        for (const range of dateRangesToSync) {
          const profitResponse = await this.client.getGrossProfitDetail(
            branchExternalId,
            range.from,
            range.to,
          );

          const groups =
            profitResponse?.results?.Groups || profitResponse?.Groups;
          if (groups) {
            for (const group of groups) {
              if (group.Items) {
                for (const item of group.Items) {
                  if (item.VuViecID) {
                    await this.grossProfitRepo.upsert(
                      {
                        hdPhieuDichVuId: item.VuViecID,
                        branchExternalId,
                        vuViecCode: item.VuViecCode,
                        vuViecName: item.VuViecName,
                        tenKhachHang: item.TenKhachHang,
                        doanhThu: item.DoanhThu,
                        chiPhi: item.ChiPhi,
                        loiNhuan: item.LoiNhuan,
                        reportFrom: range.from,
                        reportTo: range.to,
                        rawData: item,
                      },
                      ['hdPhieuDichVuId'],
                    );
                  }
                }
              }
            }
          }
          this.logger.log(
            `Synced gross profit for branch ${branchExternalId} from ${range.from} to ${range.to}`,
          );
        }
      } catch (err: any) {
        this.logger.error(`Failed to sync gross profit: ${err.message}`);
      }

      await this.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        totalRows,
        undefined,
        200,
      );
      this.logger.log(`Finished syncing cases for branch ${branchExternalId}.`);

      // 4. Soft-delete detection if full range was provided
      let deletionResult: {
        deletedCount: number;
        withLinkedInvoices: string[];
      } = {
        deletedCount: 0,
        withLinkedInvoices: [],
      };
      if (from && to) {
        deletionResult = await this.detectAndMarkDeletedCases(
          branchExternalId,
          from,
          to,
          syncedIds,
        );
      }

      return deletionResult;
    } catch (error: any) {
      await this.closeSyncRun(
        run,
        GwSyncStatus.FAILED,
        totalRows,
        error.message,
      );
      throw error;
    }
  }

  async syncGrossProfitForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing gross profit ONLY for branch ${branchExternalId}...`,
    );
    try {
      const dateRangesToSync: { from: string; to: string }[] = [];
      const parsedFrom = parseSafeDate(from);
      const parsedTo = parseSafeDate(to);

      if (parsedFrom && parsedTo) {
        dateRangesToSync.push({
          from: parsedFrom.toISOString().split('T')[0],
          to: parsedTo.toISOString().split('T')[0],
        });
      } else {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        dateRangesToSync.push({
          from: firstDay.toLocaleDateString('en-CA'),
          to: lastDay.toLocaleDateString('en-CA'),
        });
      }

      for (const range of dateRangesToSync) {
        const profitResponse = await this.client.getGrossProfitDetail(
          branchExternalId,
          range.from,
          range.to,
        );

        const results = profitResponse?.results;
        if (results?.Groups) {
          for (const group of results.Groups) {
            if (group.Items) {
              for (const item of group.Items) {
                if (item.VuViecID) {
                  await this.grossProfitRepo.upsert(
                    {
                      hdPhieuDichVuId: item.VuViecID,
                      branchExternalId,
                      vuViecCode: item.VuViecCode,
                      vuViecName: item.VuViecName,
                      tenKhachHang: item.TenKhachHang,
                      doanhThu: item.DoanhThu,
                      chiPhi: item.ChiPhi,
                      loiNhuan: item.LoiNhuan,
                      reportFrom: range.from,
                      reportTo: range.to,
                      rawData: item,
                    },
                    ['hdPhieuDichVuId'],
                  );
                }
              }
            }
          }
        }
        this.logger.log(
          `Synced gross profit for branch ${branchExternalId} from ${range.from} to ${range.to}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to sync gross profit: ${err.message}`);
      throw err;
    }
  }

  async syncReceivables(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
  ): Promise<void> {
    this.logger.log(`Syncing receivables for branch ${branchExternalId}...`);
    let page = 1;
    let totalPages = 1;
    let totalRows = 0;

    const run = await this.createSyncRun(
      branchExternalId,
      '/api/v1/gr/exports/receivables',
      { from, to, updatedSince },
      200,
    );

    try {
      do {
        const response = await this.client.getReceivables(
          branchExternalId,
          from,
          to,
          updatedSince,
          page,
          200,
        );
        const receivables = response?.data || [];
        totalPages = response?.pagination?.totalPages || 1;
        const dataAsOf = response?.dataAsOf;

        const pFrom = parseSafeDate(from) || new Date('2000-01-01');
        const pTo = parseSafeDate(to) || new Date('2099-12-31');

        for (const r of receivables) {
          let rec = await this.receivableRepo.findOne({
            where: {
              branchExternalId,
              hdPhieuDichVuId: r.HdPhieuDichVuID,
              soChungTu: r.SoChungTu || '',
              periodFrom: pFrom,
              periodTo: pTo,
            },
          });
          if (!rec) {
            rec = new KgaraReceivable();
            rec.branchExternalId = branchExternalId;
            rec.hdPhieuDichVuId = r.HdPhieuDichVuID;
            rec.soChungTu = r.SoChungTu || '';
            rec.periodFrom = pFrom;
            rec.periodTo = pTo;
          }
          rec.khachHangCode = r.KhachHangCode;
          rec.khachHangName = r.KhachHangName || r.TenKhachHang;
          rec.bienSoXe = r.BienSoXe;
          rec.soKhung = r.SoKhung;
          rec.tienThanhToan = r.TienThanhToan;
          rec.tienDaThanhToan = r.TienDaThanhToan;
          rec.ngayPhatSinh = parseSafeDate(r.NgayPhatSinh);
          rec.dataAsOf = parseSafeDate(dataAsOf);
          rec.rawData = r;

          await this.receivableRepo.save(rec);
          totalRows++;
        }
        page++;
      } while (page <= totalPages);

      await this.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        totalRows,
        undefined,
        200,
      );
      this.logger.log(
        `Finished syncing receivables for branch ${branchExternalId}.`,
      );
    } catch (error: any) {
      await this.closeSyncRun(
        run,
        GwSyncStatus.FAILED,
        totalRows,
        error.message,
      );
      throw error;
    }
  }

  async syncPayables(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
  ): Promise<void> {
    this.logger.log(`Syncing payables for branch ${branchExternalId}...`);
    let page = 1;
    let totalPages = 1;
    let totalRows = 0;

    const run = await this.createSyncRun(
      branchExternalId,
      '/api/v1/gr/exports/payables',
      { from, to, updatedSince },
      200,
    );

    try {
      do {
        const response = await this.client.getPayables(
          branchExternalId,
          from,
          to,
          updatedSince,
          page,
          200,
        );
        // V2 Payables uses extra 'results' wrapper
        const payables = response?.results?.data || [];
        totalPages = response?.results?.pagination?.totalPages || 1;
        const dataAsOf = response?.dataAsOf;

        const pFrom = parseSafeDate(from) || new Date('2000-01-01');
        const pTo = parseSafeDate(to) || new Date('2099-12-31');

        for (const p of payables) {
          let pay = await this.payableRepo.findOne({
            where: {
              branchExternalId,
              taiKhoanId: p.TaiKhoanID,
              doiTacId: p.DoiTacID,
              maSoTienTe: p.MaSoTienTe || 'VND',
              maSoVuViec: p.MaSoVuViec || '',
              periodFrom: pFrom,
              periodTo: pTo,
            },
          });
          if (!pay) {
            pay = new KgaraPayable();
            pay.branchExternalId = branchExternalId;
            pay.taiKhoanId = p.TaiKhoanID;
            pay.doiTacId = p.DoiTacID;
            pay.maSoTienTe = p.MaSoTienTe || 'VND';
            pay.maSoVuViec = p.MaSoVuViec || '';
            pay.periodFrom = pFrom;
            pay.periodTo = pTo;
          }
          pay.maSoTaiKhoan = p.MaSoTaiKhoan;
          pay.tenTaiKhoan = p.TenTaiKhoan;
          pay.maSoDoiTac = p.MaSoDoiTac;
          pay.tenDoiTac = p.TenDoiTac;
          pay.tenTienTe = p.TenTienTe;
          pay.tenVuViec = p.TenVuViec;
          pay.ghiChuDoiTac = p.GhiChuDoiTac;
          pay.maSoNhomDoiTac = p.MaSoNhomDoiTac;
          pay.tenNhomDoiTac = p.TenNhomDoiTac;
          pay.dkNo = p.DKNo;
          pay.dkCo = p.DKCo;
          pay.psNo = p.PSNo;
          pay.psCo = p.PSCo;
          pay.ckNo = p.CKNo;
          pay.ckCo = p.CKCo;
          pay.tyGiaCk = p.TyGiaCK;
          pay.dkNTeNo = p.DKNTeNo;
          pay.dkNTeCo = p.DKNTeCo;
          pay.psNTeNo = p.PSNTeNo;
          pay.psNTeCo = p.PSNTeCo;
          pay.ckNTeNo = p.CKNTeNo;
          pay.ckNTeCo = p.CKNTeCo;
          pay.tyGiaDk = p.TyGiaDK;
          pay.tyGiaPsNo = p.TyGiaPSNo;
          pay.tyGiaPsCo = p.TyGiaPSCo;
          pay.dataAsOf = parseSafeDate(dataAsOf);
          pay.rawData = p;

          await this.payableRepo.save(pay);
          totalRows++;
        }
        page++;
      } while (page <= totalPages);

      await this.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        totalRows,
        undefined,
        200,
      );
      this.logger.log(
        `Finished syncing payables for branch ${branchExternalId}.`,
      );
    } catch (error: any) {
      await this.closeSyncRun(
        run,
        GwSyncStatus.FAILED,
        totalRows,
        error.message,
      );
      throw error;
    }
  }

  async syncCaseDetail(branchExternalId: string, caseId: string): Promise<any> {
    this.logger.log(`Syncing detail for case ${caseId}...`);

    // Resolve targetCaseId and effectiveBranchId if an ERP internal UUID or soChungTu was passed
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        caseId,
      );
    let gwCase = await this.caseRepo.findOne({
      where: [
        { hdPhieuDichVuId: caseId },
        ...(isUuid ? [{ id: caseId }] : []),
        { soChungTu: caseId },
      ],
    });

    const targetCaseId = gwCase?.hdPhieuDichVuId || caseId;
    const effectiveBranchId =
      branchExternalId || gwCase?.branchExternalId || '';

    const run = await this.createSyncRun(
      effectiveBranchId,
      `/api/v1/gr/cases/detail/${targetCaseId}`,
      {},
      1,
    );

    try {
      const response = await this.client.getCaseDetail(
        targetCaseId,
        effectiveBranchId,
      );
      const caseData = response?.data;
      if (!caseData) {
        throw new Error(`Case ${targetCaseId} detail not found on Kgara`);
      }

      // Update case if exists
      if (!gwCase) {
        gwCase = await this.caseRepo.findOne({
          where: { hdPhieuDichVuId: targetCaseId },
        });
      }
      if (!gwCase) {
        gwCase = new KgaraCase();
        gwCase.hdPhieuDichVuId = targetCaseId;
        gwCase.branchExternalId = effectiveBranchId;
      }

      // State transitions handling
      const previousStatus = gwCase.tinhTrangDichVu;
      const newStatus = caseData.TinhTrangDichVu;

      // Selective mappings
      gwCase.soChungTu = caseData.SoChungTu;
      gwCase.bienSoXe = caseData.BienSoXe;
      gwCase.khachHangCode = caseData.KhachHangCode;
      gwCase.khachHangName = caseData.KhachHangName || caseData.TenKhachHang;
      gwCase.tinhTrangDichVu = newStatus;
      gwCase.tenTinhTrangDichVu = caseData.TenTinhTrangDichVu;
      gwCase.tienCoThue = caseData.TienCoThue;
      gwCase.tienDaThanhToan = caseData.TienDaThanhToan;
      gwCase.tienConPhaiThanhToan = caseData.TienConPhaiThanhToan;

      if (gwCase.id) {
        const existingSettlements = await this.settlementRepo.find({
          where: { caseId: gwCase.id },
        });
        if (existingSettlements.length > 0) {
          const totalReceipts = existingSettlements
            .filter((s) => s.settlementType === 'RECEIPT')
            .reduce((sum, s) => sum + Number(s.amount || 0), 0);
          const targetRevenue = Number(
            caseData.TienCoThue ?? caseData.DoanhThu ?? 0,
          );
          gwCase.tienDaThanhToan = totalReceipts;
          gwCase.tienConPhaiThanhToan = Math.max(
            0,
            targetRevenue - totalReceipts,
          );
        }
      }

      if (newStatus === 9) {
        // Cancelled: Clear gross profit
        gwCase.doanhThu = 0;
        gwCase.chiPhi = 0;
        gwCase.loiNhuan = 0;
        await this.grossProfitRepo.delete({ hdPhieuDichVuId: targetCaseId });

        if (gwCase.id) {
          const hasInvoices = await this.linkedInvoiceRepo.count({
            where: { caseDbId: gwCase.id },
          });
          const hasSettlements = await this.settlementRepo.count({
            where: { caseId: gwCase.id },
          });
          if (hasInvoices > 0 || hasSettlements > 0) {
            this.logger.warn(
              `ALERT: Cancelled case ${gwCase.soChungTu || gwCase.hdPhieuDichVuId} has active linked invoices (${hasInvoices}) or settlements (${hasSettlements})!`,
            );
          }
        }
      } else if (previousStatus === 3 && newStatus !== 3) {
        // Reverted from Completed (3) to In-progress: Reset GP
        gwCase.doanhThu = null;
        gwCase.chiPhi = null;
        gwCase.loiNhuan = null;
        await this.grossProfitRepo.delete({ hdPhieuDichVuId: targetCaseId });
        this.logger.log(
          `Case ${gwCase.soChungTu || gwCase.hdPhieuDichVuId} reverted from Completed (3) to In-Progress (${newStatus}). Gross profit reset.`,
        );
      } else if (newStatus === 3) {
        // Only completed status has Gross Profit
        if (caseData.DoanhThu !== undefined)
          gwCase.doanhThu = caseData.DoanhThu;
        if (caseData.ChiPhi !== undefined) gwCase.chiPhi = caseData.ChiPhi;
        if (caseData.LoiNhuan !== undefined)
          gwCase.loiNhuan = caseData.LoiNhuan;
      } else {
        // Non-completed status: Do not retain gross profit
        gwCase.doanhThu = null;
        gwCase.chiPhi = null;
        gwCase.loiNhuan = null;
      }
      gwCase.ngayPhatSinh =
        parseSafeDate(caseData.NgayPhatSinhFull) ||
        parseSafeDate(caseData.NgayPhatSinh);
      gwCase.ngayTiepNhan = parseSafeDate(caseData.NgayTiepNhan);
      gwCase.ngayHoanThanhCongViec = parseSafeDate(
        caseData.NgayHoanThanhCongViec,
      );
      gwCase.ngayGiaoXeFull = parseSafeDate(caseData.NgayGiaoXeFull);
      gwCase.soKhung = caseData.SoKhung;
      gwCase.dataAsOf = parseSafeDate(response.dataAsOf);
      gwCase.rawData = caseData;

      // Restore case if it was previously soft-deleted
      if (gwCase.kgaraDeletedAt) {
        gwCase.kgaraDeletedAt = null;
        gwCase.kgaraDeleteCount = 0;
        this.logger.log(`Case ${targetCaseId} was restored from soft-delete.`);
      }

      await this.caseRepo.save(gwCase);

      // Sync Case Services (Lines)
      let linesCount = 0;
      if (
        caseData.ListPhieuDichVuChiTiet &&
        Array.isArray(caseData.ListPhieuDichVuChiTiet)
      ) {
        for (const s of caseData.ListPhieuDichVuChiTiet) {
          let srv = await this.caseServiceRepo.findOne({
            where: { hdPhieuDichVuChiTietId: s.HdPhieuDichVuChiTietID },
          });
          if (!srv) {
            srv = new KgaraCaseService();
            srv.hdPhieuDichVuChiTietId = s.HdPhieuDichVuChiTietID;
            srv.hdPhieuDichVuId = targetCaseId;
          }

          srv.noiDungChiTiet = s.NoiDungChiTiet;
          srv.sanPhamCode = s.SanPhamCode;
          srv.sanPhamName = s.SanPhamName;
          srv.loaiSanPhamCode = s.LoaiSanPhamCode;
          srv.donViTinhText = s.DonViTinhText;
          srv.soLuongHoaDon = s.SoLuongHoaDon;
          srv.donGia = s.DonGia;
          srv.tienChuaThue = s.TienChuaThue;
          srv.thueSuat = s.ThueSuat;
          srv.tienCoThue = s.TienCoThue;
          srv.soGioCongLam = s.SoGioCongLam;
          srv.tienDichVu = s.TienDichVu;
          srv.tienPhuTung = s.TienPhuTung;
          srv.giaVonPhuTung = s.GiaVonPhuTung;
          srv.tyLeChietKhauCt = s.TyLeChietKhauCt || s.TyLeChietKhauCT;
          srv.tienChietKhauCt = s.TienChietKhauCt || s.TienChietKhauCT;
          srv.khoCode = s.KhoCode;
          srv.tienPhuPhi = s.TienPhuPhi;

          srv.rawData = s;
          await this.caseServiceRepo.save(srv);
          linesCount++;
        }
      }

      await this.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        1 + linesCount,
        undefined,
        200,
      );
      this.logger.log(`Finished syncing case detail for case ${targetCaseId}.`);
      return caseData;
    } catch (error: any) {
      await this.closeSyncRun(run, GwSyncStatus.FAILED, 0, error.message);
      throw error;
    }
  }

  /**
   * Helper to perform incremental sync using previous successful sync run watermark
   */
  async getIncrementalWatermark(
    branchExternalId: string,
    endpoint: string,
  ): Promise<string | undefined> {
    const lastRun = await this.syncRunRepo.findOne({
      where: { branchExternalId, endpoint, status: GwSyncStatus.SUCCESS },
      order: { requestStartedAt: 'DESC' },
    });
    if (!lastRun || !lastRun.requestStartedAt) return undefined;

    const lastDate = parseSafeDate(lastRun.requestStartedAt);
    if (!lastDate) return undefined;

    // Substract 10 minutes overlap as recommended
    const watermark = new Date(lastDate.getTime() - 10 * 60 * 1000);
    return watermark.toISOString();
  }

  /**
   * Helper to detect and mark soft-deleted cases that no longer exist on Kgara.
   */
  async detectAndMarkDeletedCases(
    branchExternalId: string,
    from: string,
    to: string,
    syncedIds: Set<string>,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    this.logger.log(
      `Running deletion detection for branch ${branchExternalId} from ${from} to ${to}...`,
    );

    const fromDate = parseSafeDate(from);
    const toDate = parseSafeDate(to);

    // Find all cases in ERP for this branch and date range
    const qb = this.caseRepo
      .createQueryBuilder('case')
      .where('case.branchExternalId = :branchExternalId', { branchExternalId })
      .andWhere('case.kgaraDeletedAt IS NULL');

    if (fromDate) {
      const fromStr = from.includes('T')
        ? from
        : `${from.split('T')[0]} 00:00:00`;
      qb.andWhere('case.ngayPhatSinh >= :fromStr', { fromStr });
    }
    if (toDate) {
      const toStr = to.includes('T') ? to : `${to.split('T')[0]} 23:59:59.999`;
      qb.andWhere('case.ngayPhatSinh <= :toStr', { toStr });
    }

    const erpCases = await qb.getMany();

    const deletedCases = erpCases.filter(
      (c) => !syncedIds.has(c.hdPhieuDichVuId),
    );

    if (deletedCases.length === 0) {
      return { deletedCount: 0, withLinkedInvoices: [] };
    }

    const casesWithInvoices: string[] = [];

    for (const c of deletedCases) {
      // Check if case has linked invoices
      const hasLinks = await this.linkedInvoiceRepo.count({
        where: { caseDbId: c.id },
      });

      if (hasLinks > 0) {
        casesWithInvoices.push(c.hdPhieuDichVuId);
      }

      c.kgaraDeleteCount += 1;

      // If deleted 2 or more times, mark as definitely deleted
      if (c.kgaraDeleteCount >= 2) {
        c.kgaraDeletedAt = new Date();
      }

      await this.caseRepo.save(c);

      this.logger.warn(
        `Case ${c.hdPhieuDichVuId} marked as deleted (count: ${c.kgaraDeleteCount}). Has linked invoices: ${hasLinks > 0}`,
      );
    }

    // Only count cases that actually reached the kgaraDeletedAt state,
    // or we can count all soft-delete increments. Let's return the count of newly flagged or confirmed deleted cases.
    return {
      deletedCount: deletedCases.length,
      withLinkedInvoices: casesWithInvoices,
    };
  }
}

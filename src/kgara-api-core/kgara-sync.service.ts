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
    private client: KgaraClientService,
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
    if (dataAsOf) run.dataAsOf = new Date(dataAsOf);
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
  ): Promise<void> {
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
          // Typed mappings
          gwCase.soChungTu = c.SoChungTu;
          gwCase.bienSoXe = c.BienSoXe;
          gwCase.khachHangCode = c.KhachHangCode;
          gwCase.khachHangName = c.KhachHangName || c.TenKhachHang;
          gwCase.tinhTrangDichVu = c.TinhTrangDichVu;
          gwCase.tenTinhTrangDichVu = c.TenTinhTrangDichVu;
          gwCase.tienCoThue = c.TienCoThue;
          gwCase.tienDaThanhToan = c.TienDaThanhToan;
          gwCase.tienConPhaiThanhToan = c.TienConPhaiThanhToan;
          gwCase.ngayPhatSinh = c.NgayPhatSinhFull
            ? new Date(c.NgayPhatSinhFull)
            : c.NgayPhatSinh
              ? new Date(c.NgayPhatSinh)
              : null;
          gwCase.dataAsOf = dataAsOf ? new Date(dataAsOf) : null;

          gwCase.branchExternalId = branchExternalId;
          gwCase.rawData = c;

          await this.caseRepo.save(gwCase);
          totalRows++;

          // Optionally, auto fetch detail for newly changed cases if desired.
          // For now, we rely on a separate job or client request to fetch detail.
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
      this.logger.log(`Finished syncing cases for branch ${branchExternalId}.`);
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

        for (const r of receivables) {
          const pFrom = from ? new Date(from) : new Date('2000-01-01');
          const pTo = to ? new Date(to) : new Date('2099-12-31');

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
          rec.tienThanhToan = r.TienThanhToan;
          rec.tienDaThanhToan = r.TienDaThanhToan;
          rec.ngayPhatSinh = r.NgayPhatSinh ? new Date(r.NgayPhatSinh) : null;
          rec.dataAsOf = dataAsOf ? new Date(dataAsOf) : null;
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

        for (const p of payables) {
          const pFrom = from ? new Date(from) : new Date('2000-01-01');
          const pTo = to ? new Date(to) : new Date('2099-12-31');

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
          pay.dkNo = p.DKNo;
          pay.dkCo = p.DKCo;
          pay.psNo = p.PSNo;
          pay.psCo = p.PSCo;
          pay.ckNo = p.CKNo;
          pay.ckCo = p.CKCo;
          pay.tyGiaCk = p.TyGiaCK;
          pay.dataAsOf = dataAsOf ? new Date(dataAsOf) : null;
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

  async syncCaseDetail(caseId: string, branchExternalId: string): Promise<any> {
    this.logger.log(`Syncing case detail for case ${caseId}...`);
    const run = await this.createSyncRun(
      branchExternalId,
      '/api/v1/gr/cases/detail',
      { id: caseId },
      1,
    );

    try {
      const response = await this.client.getCaseDetail(
        caseId,
        branchExternalId,
      );
      const caseData = response?.data;
      if (!caseData) {
        await this.closeSyncRun(
          run,
          GwSyncStatus.FAILED,
          0,
          'No data returned',
        );
        return null;
      }

      // Update case if exists
      let gwCase = await this.caseRepo.findOne({
        where: { hdPhieuDichVuId: caseId },
      });
      if (!gwCase) {
        gwCase = new KgaraCase();
        gwCase.hdPhieuDichVuId = caseId;
        gwCase.branchExternalId = branchExternalId;
      }
      gwCase.soChungTu = caseData.SoChungTu;
      gwCase.bienSoXe = caseData.BienSoXe;
      gwCase.khachHangCode = caseData.KhachHangCode;
      gwCase.khachHangName = caseData.KhachHangName || caseData.TenKhachHang;
      gwCase.tinhTrangDichVu = caseData.TinhTrangDichVu;
      gwCase.tienCoThue = caseData.TienCoThue;
      gwCase.tienDaThanhToan = caseData.TienDaThanhToan;
      gwCase.tienConPhaiThanhToan = caseData.TienConPhaiThanhToan;
      gwCase.ngayPhatSinh = caseData.NgayPhatSinhFull
        ? new Date(caseData.NgayPhatSinhFull)
        : caseData.NgayPhatSinh
          ? new Date(caseData.NgayPhatSinh)
          : null;
      gwCase.dataAsOf = response.dataAsOf ? new Date(response.dataAsOf) : null;
      gwCase.rawData = caseData;
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
            srv.hdPhieuDichVuId = caseId;
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
      this.logger.log(`Finished syncing case detail for case ${caseId}.`);
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
    if (!lastRun) return undefined;

    // Substract 10 minutes overlap as recommended
    const watermark = new Date(
      lastRun.requestStartedAt.getTime() - 10 * 60 * 1000,
    );
    return watermark.toISOString();
  }
}

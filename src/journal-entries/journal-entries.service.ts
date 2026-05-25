import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDirectus, rest, staticToken } from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { JournalEntryQueryDto } from './dto/journal-entry-query.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class JournalEntriesService {
  private readonly logger = new Logger(JournalEntriesService.name);
  private readonly collection = 'erp_journal_entries';
  private readonly linesCollection = 'erp_journal_entry_lines';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  private get directusUrl() {
    return this.configService.getOrThrow<string>('DIRECTUS_URL');
  }

  private get adminToken() {
    return this.configService.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  private getAdminHeaders() {
    return { Authorization: `Bearer ${this.adminToken}` };
  }

  private getUserHeaders(userToken: string) {
    return { Authorization: `Bearer ${userToken}` };
  }

  private validateBalanced(lines: CreateJournalEntryDto['lines']) {
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    // Round to avoid float precision errors
    const d = Math.round(totalDebit * 100);
    const c = Math.round(totalCredit * 100);
    if (d !== c) {
      throw new BadRequestException(
        `Bút toán mất cân: tổng nợ ${totalDebit} ≠ tổng có ${totalCredit}`,
      );
    }
    return { totalDebit, totalCredit };
  }

  // ─── findAll ──────────────────────────────────────────────────────────────

  async findAll(query: JournalEntryQueryDto, userToken: string) {
    this.guard(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '-date';
      const offset = (page - 1) * pageSize;

      const url = new URL(`/items/${this.collection}`, this.directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort[]', sort);
      // Join period
      url.searchParams.append('fields[]', '*');
      url.searchParams.append('fields[]', 'period_id.id');
      url.searchParams.append('fields[]', 'period_id.name');

      if (query.search) url.searchParams.append('search', query.search);

      const filterAnd: any[] = [];
      // Journal list only shows posted entries
      filterAnd.push({ status: { _in: ['posted', 'reversed'] } });
      if (query.status) filterAnd.push({ status: { _eq: query.status } });
      if (query.period_id)
        filterAnd.push({ period_id: { _eq: query.period_id } });
      if (query.date_from) filterAnd.push({ date: { _gte: query.date_from } });
      if (query.date_to) filterAnd.push({ date: { _lte: query.date_to } });

      // Filter by account_id: Directus không có O2M alias trên journal_entries,
      // nên query journal_entry_lines trước rồi filter header theo id.
      if (query.account_id) {
        const lineUrl = new URL(
          `/items/${this.linesCollection}`,
          this.directusUrl,
        );
        lineUrl.searchParams.append(
          'filter',
          JSON.stringify({ account_id: { _eq: query.account_id } }),
        );
        lineUrl.searchParams.append('fields[]', 'journal_entry_id');
        lineUrl.searchParams.append('limit', '-1');
        const lineRes = await fetch(lineUrl.toString(), {
          headers: this.getAdminHeaders(),
        });
        if (!lineRes.ok) {
          await throwDirectusResponseError(
            lineRes,
            'Không thể filter bút toán theo tài khoản',
          );
        }
        const lineJson = await lineRes.json();
        const entryIds = Array.from(
          new Set(
            (lineJson.data || [])
              .map((line: any) =>
                typeof line.journal_entry_id === 'object'
                  ? line.journal_entry_id.id
                  : line.journal_entry_id,
              )
              .filter(Boolean),
          ),
        );
        if (entryIds.length === 0) {
          return { items: [], total: 0, page, pageSize, totalPages: 0 };
        }
        filterAnd.push({ id: { _in: entryIds } });
      }

      if (filterAnd.length > 0) {
        url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
      }

      const response = await fetch(url.toString(), {
        headers: this.getUserHeaders(userToken),
      });

      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách bút toán',
        );
      }

      const result = await response.json();
      const total = result.meta?.filter_count || 0;
      const entries = result.data || [];

      // Fetch all lines for entries on this page in one call
      let linesMap: Record<string, any[]> = {};
      if (entries.length > 0) {
        const entryIds = entries.map((e: any) => e.id);
        const lUrl = new URL(
          `/items/${this.linesCollection}`,
          this.directusUrl,
        );
        lUrl.searchParams.append(
          'filter',
          JSON.stringify({ journal_entry_id: { _in: entryIds } }),
        );
        lUrl.searchParams.append('fields[]', 'id');
        lUrl.searchParams.append('fields[]', 'journal_entry_id');
        lUrl.searchParams.append('fields[]', 'account_id.id');
        lUrl.searchParams.append('fields[]', 'account_id.account_code');
        lUrl.searchParams.append('fields[]', 'account_id.account_name');
        lUrl.searchParams.append('fields[]', 'debit');
        lUrl.searchParams.append('fields[]', 'credit');
        lUrl.searchParams.append('fields[]', 'description');
        lUrl.searchParams.append('fields[]', 'sort');
        lUrl.searchParams.append('sort[]', 'sort');
        lUrl.searchParams.append('limit', '-1');
        const lRes = await fetch(lUrl.toString(), {
          headers: this.getAdminHeaders(),
        });
        if (lRes.ok) {
          const lJson = await lRes.json();
          for (const line of lJson.data || []) {
            const eid =
              typeof line.journal_entry_id === 'object'
                ? line.journal_entry_id?.id
                : line.journal_entry_id;
            if (!linesMap[eid]) linesMap[eid] = [];
            linesMap[eid].push(line);
          }
        }
      }

      return {
        items: entries.map((e: any) => ({ ...e, lines: linesMap[e.id] || [] })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách bút toán', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(`Lỗi: ${error.message}`);
    }
  }

  // ─── findOne ──────────────────────────────────────────────────────────────

  async findOne(id: string, userToken: string) {
    this.guard(userToken);
    try {
      const url = new URL(`/items/${this.collection}/${id}`, this.directusUrl);
      url.searchParams.append('fields[]', '*');
      url.searchParams.append('fields[]', 'period_id.id');
      url.searchParams.append('fields[]', 'period_id.name');

      const response = await fetch(url.toString(), {
        headers: this.getUserHeaders(userToken),
      });

      if (response.status === 404) {
        throw new NotFoundException(`Không tìm thấy bút toán: ${id}`);
      }
      if (!response.ok) {
        await throwDirectusResponseError(response, 'Không thể lấy bút toán');
      }

      const result = await response.json();

      const lineUrl = new URL(
        `/items/${this.linesCollection}`,
        this.directusUrl,
      );
      lineUrl.searchParams.append(
        'filter',
        JSON.stringify({ journal_entry_id: { _eq: id } }),
      );
      lineUrl.searchParams.append('fields[]', 'id');
      lineUrl.searchParams.append('fields[]', 'account_id.id');
      lineUrl.searchParams.append('fields[]', 'account_id.account_code');
      lineUrl.searchParams.append('fields[]', 'account_id.account_name');
      lineUrl.searchParams.append('fields[]', 'debit');
      lineUrl.searchParams.append('fields[]', 'credit');
      lineUrl.searchParams.append('fields[]', 'description');
      lineUrl.searchParams.append('fields[]', 'sort');
      lineUrl.searchParams.append('sort[]', 'sort');

      const linesResponse = await fetch(lineUrl.toString(), {
        headers: this.getAdminHeaders(),
      });
      if (!linesResponse.ok) {
        await throwDirectusResponseError(
          linesResponse,
          'Không thể lấy dòng bút toán',
        );
      }
      const linesResult = await linesResponse.json();

      return {
        message: 'Lấy thông tin bút toán thành công',
        data: { ...result.data, lines: linesResult.data || [] },
      };
    } catch (error: any) {
      rethrowHttpException(error);
      throw new InternalServerErrorException(`Lỗi: ${error.message}`);
    }
  }

  // ─── create ───────────────────────────────────────────────────────────────

  async create(dto: CreateJournalEntryDto, userToken: string) {
    this.guard(userToken);
    const { totalDebit, totalCredit } = this.validateBalanced(dto.lines);

    // Get current user id for created_by
    const meRes = await fetch(`${this.directusUrl}/users/me?fields=id`, {
      headers: this.getUserHeaders(userToken),
    });
    if (!meRes.ok)
      throw new UnauthorizedException('Không xác thực được người dùng');
    const meJson = await meRes.json();
    const userId = meJson.data?.id;

    // If period_id not provided, try to find open period matching date
    let period_id = dto.period_id || null;
    if (!period_id && dto.date) {
      const pUrl = new URL('/items/erp_accounting_periods', this.directusUrl);
      pUrl.searchParams.append(
        'filter',
        JSON.stringify({
          _and: [
            { status: { _eq: 'open' } },
            { start_date: { _lte: dto.date } },
            { end_date: { _gte: dto.date } },
          ],
        }),
      );
      pUrl.searchParams.append('limit', '1');
      pUrl.searchParams.append('fields[]', 'id');
      const pRes = await fetch(pUrl.toString(), {
        headers: this.getAdminHeaders(),
      });
      if (pRes.ok) {
        const pJson = await pRes.json();
        if (pJson.data?.[0]?.id) period_id = pJson.data[0].id;
      }
    }

    // Generate voucher_no if not provided
    let voucher_no = dto.voucher_no;
    if (!voucher_no) {
      const dateStr = dto.date.replace(/-/g, '').slice(0, 8);
      const countRes = await fetch(
        `${this.directusUrl}/items/${this.collection}?aggregate[count]=id`,
        { headers: this.getAdminHeaders() },
      );
      let seq = 1;
      if (countRes.ok) {
        const countJson = await countRes.json();
        seq = (Number(countJson.data?.[0]?.count?.id || 0) || 0) + 1;
      }
      voucher_no = `JNL-${dateStr}-${String(seq).padStart(4, '0')}`;
    }

    // Create journal_entry header
    const headerRes = await fetch(
      `${this.directusUrl}/items/${this.collection}`,
      {
        method: 'POST',
        headers: {
          ...this.getAdminHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voucher_no,
          date: dto.date,
          period_id,
          description: dto.description || null,
          status: 'posted',
          reference_type: dto.reference_type || null,
          reference_id: dto.reference_id || null,
          total_debit: totalDebit,
          total_credit: totalCredit,
          created_by: userId,
        }),
      },
    );

    if (!headerRes.ok) {
      await throwDirectusResponseError(headerRes, 'Không thể tạo bút toán');
    }

    const headerJson = await headerRes.json();
    const journalEntryId = headerJson.data?.id;

    if (!journalEntryId) {
      throw new InternalServerErrorException(
        'Tạo bút toán thất bại: không có ID trả về',
      );
    }

    // Create lines
    const linesPayload = dto.lines.map((l, idx) => ({
      journal_entry_id: journalEntryId,
      account_id: l.account_id,
      debit: l.debit || 0,
      credit: l.credit || 0,
      description: l.description || null,
      sort: l.sort ?? idx,
    }));

    const linesRes = await fetch(
      `${this.directusUrl}/items/${this.linesCollection}`,
      {
        method: 'POST',
        headers: {
          ...this.getAdminHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(linesPayload),
      },
    );

    if (!linesRes.ok) {
      // Rollback: delete header
      await fetch(
        `${this.directusUrl}/items/${this.collection}/${journalEntryId}`,
        {
          method: 'DELETE',
          headers: this.getAdminHeaders(),
        },
      );
      await throwDirectusResponseError(
        linesRes,
        'Không thể tạo dòng bút toán (đã rollback header)',
      );
    }

    const linesJson = await linesRes.json();

    return {
      message: 'Tạo bút toán thành công',
      data: { ...headerJson.data, lines: linesJson.data },
    };
  }

  // ─── post (hạch toán) ─────────────────────────────────────────────────────

  async post(id: string, userToken: string) {
    this.guard(userToken);

    // Load entry với user token (kiểm tra quyền)
    const entryRes = await fetch(
      `${this.directusUrl}/items/${this.collection}/${id}?fields[]=id,status`,
      { headers: this.getUserHeaders(userToken) },
    );
    if (entryRes.status === 404)
      throw new NotFoundException(`Không tìm thấy bút toán: ${id}`);
    if (!entryRes.ok)
      await throwDirectusResponseError(entryRes, 'Không thể tải bút toán');

    const entryJson = await entryRes.json();
    const entry = entryJson.data;

    if (entry.status === 'posted') {
      return { message: 'Bút toán đã ở trạng thái posted', data: entry };
    }

    throw new BadRequestException(
      `Journal Entry không còn workflow Draft/Post thủ công. Trạng thái hiện tại: ${entry.status}`,
    );
  }

  // ─── lookup: accounting periods ──────────────────────────────────────────

  async findPeriodOptions(userToken: string) {
    this.guard(userToken);
    const url = new URL('/items/erp_accounting_periods', this.directusUrl);
    url.searchParams.append('fields[]', 'id');
    url.searchParams.append('fields[]', 'name');
    url.searchParams.append('fields[]', 'status');
    url.searchParams.append('fields[]', 'start_date');
    url.searchParams.append('fields[]', 'end_date');
    url.searchParams.append('sort[]', '-start_date');
    url.searchParams.append('limit', '50');

    const res = await fetch(url.toString(), {
      headers: this.getAdminHeaders(),
    });
    if (!res.ok)
      await throwDirectusResponseError(
        res,
        'Không thể lấy danh sách kỳ kế toán',
      );
    const json = await res.json();
    return { items: json.data || [] };
  }

  // ─── lookup: chart of accounts ───────────────────────────────────────────

  async findAccountOptions(search: string | undefined, userToken: string) {
    this.guard(userToken);
    const url = new URL('/items/erp_chart_of_accounts', this.directusUrl);
    url.searchParams.append('fields[]', 'id');
    url.searchParams.append('fields[]', 'account_code');
    url.searchParams.append('fields[]', 'account_name');
    url.searchParams.append('fields[]', 'account_type');
    url.searchParams.append('sort[]', 'account_code');
    url.searchParams.append('limit', '200');
    if (search) url.searchParams.append('search', search);

    const res = await fetch(url.toString(), {
      headers: this.getAdminHeaders(),
    });
    if (!res.ok)
      await throwDirectusResponseError(
        res,
        'Không thể lấy danh sách tài khoản kế toán',
      );
    const json = await res.json();
    return { items: json.data || [] };
  }
}

import { Subject } from 'rxjs';

import type { ExportProgressEvent } from '../types/export-job.types';

import { sendReadyExportFile, XLSX_MIME } from './export-download.helper';
import {
  formatExportTimestamp,
  formatExportTimestampNoSeconds,
} from './export-file-name.helper';
import {
  normalizeJsonString,
  stableStringify,
} from './export-fingerprint.helper';
import { isExportJobsV2Enabled } from './export-jobs-flag';
import { applySseHeaders, exportProgressStream } from './export-sse.helper';

const event = (over: Partial<ExportProgressEvent>): ExportProgressEvent => ({
  processId: 'p',
  current: 1,
  total: 2,
  isRunning: true,
  completed: false,
  ready: false,
  failed: false,
  ...over,
});

describe('export-jobs-core helpers', () => {
  describe('fingerprint', () => {
    it('stableStringify không phụ thuộc thứ tự khoá', () => {
      expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(
        stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }),
      );
    });

    it('normalizeJsonString chuẩn hoá JSON hợp lệ và giữ chuỗi lỗi sau trim', () => {
      expect(normalizeJsonString('{"b":1,"a":2}')).toBe('{"a":2,"b":1}');
      expect(normalizeJsonString('  not json ')).toBe('not json');
      expect(normalizeJsonString(undefined)).toBe('');
    });
  });

  describe('file name', () => {
    const d = new Date(2026, 10, 5, 9, 7, 3);
    it('có giây: YYYYMMDD_HHmmss', () => {
      expect(formatExportTimestamp(d)).toBe('20261105_090703');
    });
    it('không giây: YYYYMMDD_HHmm', () => {
      expect(formatExportTimestampNoSeconds(d)).toBe('20261105_0907');
    });
  });

  describe('isExportJobsV2Enabled', () => {
    it('mặc định bật', () => {
      expect(isExportJobsV2Enabled({})).toBe(true);
      expect(isExportJobsV2Enabled({ EXPORT_JOBS_V2: '' })).toBe(true);
      expect(isExportJobsV2Enabled({ EXPORT_JOBS_V2: 'true' })).toBe(true);
    });
    it('tắt khi false, 0, off, no', () => {
      for (const v of ['false', 'FALSE', '0', 'off', 'no']) {
        expect(isExportJobsV2Enabled({ EXPORT_JOBS_V2: v })).toBe(false);
      }
    });
  });

  describe('sendReadyExportFile', () => {
    const make = () => {
      const headers: Record<string, string> = {};
      const res = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
        send: jest.fn(),
      };
      return { headers, res };
    };
    const source = {
      getReadyFile: jest.fn(() => ({
        buffer: Buffer.from('x'),
        fileName: 'Báo cáo.xlsx',
      })),
    };

    it('gửi buffer với MIME xlsx và tên file nguyên bản', () => {
      const { headers, res } = make();
      sendReadyExportFile(source, 'j1', 'u1', res);
      expect(source.getReadyFile).toHaveBeenCalledWith('j1', 'u1');
      expect(headers['Content-Type']).toBe(XLSX_MIME);
      expect(headers['Content-Disposition']).toBe(
        'attachment; filename="Báo cáo.xlsx"',
      );
      expect(res.send).toHaveBeenCalledWith(Buffer.from('x'));
    });

    it('encodeFileName mã hoá tên file như công nợ hóa đơn', () => {
      const { headers, res } = make();
      sendReadyExportFile(source, 'j1', 'u1', res, { encodeFileName: true });
      expect(headers['Content-Disposition']).toBe(
        `attachment; filename="${encodeURIComponent('Báo cáo.xlsx')}"`,
      );
    });
  });

  describe('applySseHeaders', () => {
    it('đặt header tắt đệm và flush', () => {
      const headers: Record<string, string> = {};
      const flushHeaders = jest.fn();
      applySseHeaders({
        setHeader: (k, v) => {
          headers[k] = v;
        },
        flushHeaders,
      });
      expect(headers['Content-Type']).toBe('text/event-stream');
      expect(headers['X-Accel-Buffering']).toBe('no');
      expect(flushHeaders).toHaveBeenCalled();
    });
  });

  describe('exportProgressStream', () => {
    afterEach(() => jest.useRealTimers());

    it('phát Connected, snapshot, rồi chỉ sự kiện của đúng user và ping định kỳ', () => {
      jest.useFakeTimers();
      const progress$ = new Subject<ExportProgressEvent>();
      const snapshot = event({ userId: 'u1', jobId: 'j1' });
      const source = { progress$, getJobSnapshotForUser: () => snapshot };
      const received: ExportProgressEvent[] = [];

      const sub = exportProgressStream(source, 'u1', {
        pingIntervalMs: 1000,
      }).subscribe((m) => received.push(JSON.parse(String(m.data))));

      progress$.next(event({ userId: 'u2', jobId: 'other' }));
      progress$.next(event({ userId: 'u1', jobId: 'j2' }));
      jest.advanceTimersByTime(1000);
      sub.unsubscribe();

      expect(received.map((e) => e.message ?? e.jobId)).toEqual([
        'Connected',
        'j1',
        'j2',
        'Ping',
      ]);
      expect(received[0].processId).toBe('ping');
    });

    it('không có snapshot thì bỏ qua và huỷ interval khi unsubscribe', () => {
      jest.useFakeTimers();
      const source = {
        progress$: new Subject<ExportProgressEvent>(),
        getJobSnapshotForUser: () => null,
      };
      const received: unknown[] = [];
      const sub = exportProgressStream(source, 'u1').subscribe((m) =>
        received.push(m),
      );
      sub.unsubscribe();
      jest.advanceTimersByTime(60000);
      expect(received).toHaveLength(1);
    });
  });
});

import { BadRequestException } from '@nestjs/common';
import { DebtsExportController } from './debts-export.controller';
import type { DebtsExportJobsService } from '../services/debts-export-jobs.service';

function makeController() {
  const history = jest.fn().mockReturnValue({ items: [] });
  const jobs = {
    start: jest.fn().mockReturnValue({ jobId: 'j1' }),
    runner: jest.fn().mockReturnValue({ listHistoryForUser: history }),
  };
  const controller = new DebtsExportController(
    jobs as unknown as DebtsExportJobsService,
  );
  return { controller, jobs, history };
}

describe('DebtsExportController', () => {
  it('start chuyển kind, chi nhánh và user cho service', () => {
    const { controller, jobs } = makeController();

    const res = controller.start('customers', {}, 'b1', {
      user: { sub: 'u1' },
    });

    expect(res).toEqual({ jobId: 'j1' });
    expect(jobs.start).toHaveBeenCalledWith('customers', {}, 'b1', 'u1');
  });

  it('thiếu user trong token thì từ chối', () => {
    const { controller } = makeController();
    expect(() => controller.start('all', {}, 'b1', {})).toThrow(
      BadRequestException,
    );
  });

  it('history chuyển page, pageSize dạng số', () => {
    const { controller, history } = makeController();

    controller.history('suppliers', { user: { sub: 'u1' } }, '2', '5');

    expect(history).toHaveBeenCalledWith('u1', 2, 5);
  });
});

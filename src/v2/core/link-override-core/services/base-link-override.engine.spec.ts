import { NotFoundException } from '@nestjs/common';
import type {
  LinkSourcePort,
  LinkSourceValues,
} from '../contracts/link-source.port';
import { BaseLinkOverrideEngine } from './base-link-override.engine';

class FakeSource implements LinkSourcePort {
  constructor(public data: Record<string, LinkSourceValues | null>) {}
  findValues(id: string) {
    return Promise.resolve(this.data[id] ?? null);
  }
}

class TestEngine extends BaseLinkOverrideEngine {
  protected readonly trackedKeys = new Set(['branchName', 'since']);
  protected readonly dateKeys = new Set(['since']);
}

describe('BaseLinkOverrideEngine', () => {
  const src = new FakeSource({
    b1: {
      branchName: 'Chi nhánh 1',
      since: new Date('2026-01-01T00:00:00Z'),
      ignored: 1,
    },
    b2: { branchName: 'Chi nhánh 2' },
  });
  const engine = new TestEngine(src);

  it('capture lập snapshot từ nguồn, chỉ giữ khóa theo dõi, không đánh dấu override', async () => {
    const r = await engine.capture('b1');
    expect(r.sourceSnapshot).toEqual({
      branchName: 'Chi nhánh 1',
      since: '2026-01-01T00:00:00.000Z',
    });
    expect(r.values).toEqual({
      branchName: 'Chi nhánh 1',
      since: new Date('2026-01-01T00:00:00Z'),
    });
    expect(r.overrides).toEqual({});
  });

  it('capture với edits đánh dấu override khi khác nguồn, bỏ khóa không theo dõi', async () => {
    const r = await engine.capture('b1', {
      branchName: 'Tên riêng',
      other: 'x',
    });
    expect(r.values.branchName).toBe('Tên riêng');
    expect(r.values).not.toHaveProperty('other');
    expect(r.overrides).toEqual({ branchName: true });
  });

  it('capture ném NotFound khi nguồn không tồn tại', async () => {
    await expect(engine.capture('zzz')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('applyEdit đánh dấu rồi bỏ dấu khi trùng lại nguồn', async () => {
    const state = await engine.capture('b1');
    const o1 = engine.applyEdit({ branchName: 'Sửa' }, state);
    expect(o1).toEqual({ branchName: true });
    const o2 = engine.applyEdit(
      { branchName: 'Chi nhánh 1' },
      { ...state, overrides: o1 },
    );
    expect(o2).toEqual({});
  });

  it('revert đưa giá trị về snapshot và bỏ dấu', async () => {
    const state = await engine.capture('b1', { branchName: 'Sửa' });
    const r = engine.revert(['branchName', 'bogus'], state);
    expect(r.values).toEqual({ branchName: 'Chi nhánh 1' });
    expect(r.overrides).toEqual({});
  });

  it('refresh giữ field đang override, cập nhật field còn lại, force thì về nguồn', async () => {
    src.data.b1 = {
      branchName: 'Tên mới',
      since: new Date('2026-02-02T00:00:00Z'),
    };
    const state = await engine.capture('b2', { branchName: 'Sửa' });
    const kept = await engine.refresh('b1', state);
    expect(kept.values).toEqual({ since: new Date('2026-02-02T00:00:00Z') });
    expect(kept.overrides).toEqual({ branchName: true });
    const forced = await engine.refresh('b1', state, ['branchName']);
    expect(forced.values.branchName).toBe('Tên mới');
    expect(forced.overrides).toEqual({});
  });
});

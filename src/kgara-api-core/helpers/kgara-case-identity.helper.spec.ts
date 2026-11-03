import { buildGuidMap, resolveCaseGuid } from './kgara-case-identity.helper';

describe('kgara-case-identity helper', () => {
  describe('buildGuidMap', () => {
    it('maps SoChungTu to HdPhieuDichVuID', () => {
      const map = buildGuidMap([
        { SoChungTu: 'GN-PDV2610-0007', HdPhieuDichVuID: 'uuid-a' },
        { SoChungTu: 'GN-PDV2610-0013', HdPhieuDichVuID: 'uuid-b' },
      ]);
      expect(map.get('GN-PDV2610-0007')).toBe('uuid-a');
      expect(map.get('GN-PDV2610-0013')).toBe('uuid-b');
      expect(map.size).toBe(2);
    });

    it('skips rows missing either code or guid', () => {
      const map = buildGuidMap([
        { SoChungTu: null, HdPhieuDichVuID: 'uuid-a' },
        { SoChungTu: 'GN-X', HdPhieuDichVuID: '' },
        { SoChungTu: '  ', HdPhieuDichVuID: 'uuid-c' },
      ]);
      expect(map.size).toBe(0);
    });

    it('keeps the first occurrence when a code repeats', () => {
      const map = buildGuidMap([
        { SoChungTu: 'GN-DUP', HdPhieuDichVuID: 'uuid-first' },
        { SoChungTu: 'GN-DUP', HdPhieuDichVuID: 'uuid-second' },
      ]);
      expect(map.get('GN-DUP')).toBe('uuid-first');
    });
  });

  describe('resolveCaseGuid', () => {
    const guidMap = new Map([['GN-PDV2610-0007', 'uuid-oj']]);

    it('prefers HdPhieuDichVuID already present on the list row (MAIN)', () => {
      expect(
        resolveCaseGuid(
          { SoChungTu: 'GR-PDV2610-0001', HdPhieuDichVuID: 'uuid-main' },
          guidMap,
        ),
      ).toBe('uuid-main');
    });

    it('resolves through SoChungTu when the row has no GUID (OJ)', () => {
      expect(
        resolveCaseGuid(
          { SoChungTu: 'GN-PDV2610-0007', HdPhieuDichVuID: undefined },
          guidMap,
        ),
      ).toBe('uuid-oj');
    });

    it('returns null when no GUID can be found', () => {
      expect(resolveCaseGuid({ SoChungTu: 'GN-UNKNOWN' }, guidMap)).toBeNull();
    });

    it('never returns undefined or an empty string', () => {
      expect(resolveCaseGuid({}, guidMap)).toBeNull();
      expect(resolveCaseGuid({ SoChungTu: '' }, guidMap)).toBeNull();
      expect(
        resolveCaseGuid({ HdPhieuDichVuID: '   ', SoChungTu: '' }, guidMap),
      ).toBeNull();
    });
  });
});

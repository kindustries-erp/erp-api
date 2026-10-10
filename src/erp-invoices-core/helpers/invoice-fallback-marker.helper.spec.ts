import {
  buildFallbackMarker,
  hasFallbackMarker,
  stripFallbackMarker,
  withFallbackMarker,
} from './invoice-fallback-marker.helper';

describe('invoice-fallback-marker.helper', () => {
  it('builds a marker with or without a reason', () => {
    expect(buildFallbackMarker()).toBe('[T0003_FALLBACK]');
    expect(buildFallbackMarker('ai_error')).toBe('[T0003_FALLBACK:AI_ERROR]');
    expect(buildFallbackMarker('bad reason!')).toBe('[T0003_FALLBACK]');
  });

  it('appends the marker only for fallback postings', () => {
    expect(withFallbackMarker('1-A_Mua hàng', false, 'AI_ERROR')).toBe(
      '1-A_Mua hàng',
    );
    expect(withFallbackMarker('1-A_Mua hàng', true, 'AI_ERROR')).toBe(
      '1-A_Mua hàng [T0003_FALLBACK:AI_ERROR]',
    );
  });

  it('does not duplicate the marker', () => {
    const once = withFallbackMarker('x', true, 'LOW_CONFIDENCE');
    expect(withFallbackMarker(once, true, 'AI_ERROR')).toBe(
      'x [T0003_FALLBACK:AI_ERROR]',
    );
  });

  it('detects and strips the marker', () => {
    const d = 'x [T0003_FALLBACK:INVALID_CODE]';
    expect(hasFallbackMarker(d)).toBe(true);
    expect(hasFallbackMarker('x')).toBe(false);
    expect(stripFallbackMarker(d)).toBe('x');
    expect(stripFallbackMarker(null)).toBeNull();
  });
});

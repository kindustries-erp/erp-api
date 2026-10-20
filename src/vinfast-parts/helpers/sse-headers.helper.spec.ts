import { applySseHeaders, SSE_PING_INTERVAL_MS } from './sse-headers.helper';

describe('applySseHeaders', () => {
  it('disables proxy buffering and flushes the stream headers', () => {
    const setHeader = jest.fn();
    const flushHeaders = jest.fn();

    applySseHeaders({ setHeader, flushHeaders });

    expect(setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-cache, no-transform',
    );
    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(flushHeaders).toHaveBeenCalledTimes(1);
  });

  it('works when the response has no flushHeaders', () => {
    const setHeader = jest.fn();
    expect(() => applySseHeaders({ setHeader })).not.toThrow();
  });

  it('keeps the keep-alive ping at 10 seconds', () => {
    expect(SSE_PING_INTERVAL_MS).toBe(10000);
  });
});

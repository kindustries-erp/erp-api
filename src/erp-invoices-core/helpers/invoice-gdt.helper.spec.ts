import {
  fetchWithRetry,
  GdtNonJsonResponseError,
  GdtTokenExpiredError,
  parseGdtJson,
} from './invoice-gdt.helper';

describe('fetchWithRetry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw GdtTokenExpiredError on 401 without retrying', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 401 }));

    await expect(
      fetchWithRetry('https://hoadondientu.gdt.gov.vn/x'),
    ).rejects.toBeInstanceOf(GdtTokenExpiredError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw GdtTokenExpiredError on 403 without retrying', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 403 }));

    const error = await fetchWithRetry(
      'https://hoadondientu.gdt.gov.vn/x',
    ).catch((e) => e);

    expect(error.message).toBe('GDT_TOKEN_EXPIRED');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('parseGdtJson', () => {
  it('should parse a valid JSON body', async () => {
    const res = new Response(JSON.stringify({ datas: [{ nbmst: '0100' }] }));

    await expect(parseGdtJson(res)).resolves.toEqual({
      datas: [{ nbmst: '0100' }],
    });
  });

  it('should throw GdtNonJsonResponseError with a snippet when body is HTML', async () => {
    const html =
      '<!DOCTYPE html><html><body>Hệ thống đang bảo trì</body></html>';
    const res = new Response(html, { status: 200 });

    const error = await parseGdtJson(res).catch((e) => e);

    expect(error).toBeInstanceOf(GdtNonJsonResponseError);
    expect(error.snippet).toBe(html);
    expect(error.message).toContain('không phải JSON');
  });

  it('should cap the snippet length at 200 characters', async () => {
    const res = new Response('<'.repeat(500), { status: 200 });

    const error = await parseGdtJson(res).catch((e) => e);

    expect(error.snippet).toHaveLength(200);
  });
});

import { GdtNonJsonResponseError, parseGdtJson } from './invoice-gdt.helper';

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

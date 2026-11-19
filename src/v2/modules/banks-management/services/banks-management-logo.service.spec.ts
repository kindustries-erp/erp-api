import { BanksManagementLogoService } from './banks-management-logo.service';

describe('BanksManagementLogoService', () => {
  let service: BanksManagementLogoService;

  beforeEach(() => {
    service = new BanksManagementLogoService();
    service.clearCache();
  });

  it('should return cached buffer when available', async () => {
    const rawBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
    const mockPngBuffer = Buffer.from(rawBytes.buffer);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => rawBytes.buffer,
    } as any);

    const firstResult = await service.getLogoBuffer('ABB');
    expect(firstResult.contentType).toBe('image/png');
    expect(firstResult.buffer.equals(mockPngBuffer)).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Call lần 2 phải đọc từ cache, không fetch lại
    const secondResult = await service.getLogoBuffer('ABB');
    expect(secondResult.contentType).toBe('image/png');
    expect(secondResult.buffer.equals(mockPngBuffer)).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should return SVG fallback buffer when fetch fails or returns 404', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await service.getLogoBuffer('UNKNOWN_BANK');
    expect(result.contentType).toBe('image/svg+xml');
    const svgContent = result.buffer.toString('utf-8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('UNKNOWN_');
  });

  it('should return fallback SVG when code is empty', async () => {
    const result = await service.getLogoBuffer('');
    expect(result.contentType).toBe('image/svg+xml');
    const svgContent = result.buffer.toString('utf-8');
    expect(svgContent).toContain('BANK');
  });
});

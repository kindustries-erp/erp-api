import { ProviderAdapterRegistry } from './provider-adapter.registry';
import {
  IProviderAdapter,
  DownloadPdfParams,
  DownloadPdfResult,
} from './provider-adapter.interface';

describe('ProviderAdapterRegistry', () => {
  let registry: ProviderAdapterRegistry;

  const mockAdapter: IProviderAdapter = {
    providerCode: 'MISA',
    canHandle: (code) => code === 'MISA',
    downloadOriginalPdf: async (
      _params: DownloadPdfParams,
    ): Promise<DownloadPdfResult> => {
      return {
        success: true,
        source: 'provider_original',
        pdfBuffer: Buffer.from('%PDF-1.4'),
      };
    },
  };

  beforeEach(() => {
    registry = new ProviderAdapterRegistry();
  });

  it('should register and retrieve adapter by case-insensitive key', () => {
    registry.register(mockAdapter);

    expect(registry.hasAdapter('misa')).toBe(true);
    expect(registry.hasAdapter('MISA')).toBe(true);
    expect(registry.getAdapter('misa')).toBe(mockAdapter);
    expect(registry.getSupportedProviders()).toEqual(['MISA']);
  });

  it('should return undefined for unregistered provider', () => {
    expect(registry.hasAdapter('VINFAST')).toBe(false);
    expect(registry.getAdapter('VINFAST')).toBeUndefined();
  });
});

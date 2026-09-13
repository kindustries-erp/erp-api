import { resolveS3Endpoint } from './r2.service';

describe('resolveS3Endpoint', () => {
  it('uses the explicit S3-compatible endpoint when configured', () => {
    expect(
      resolveS3Endpoint({
        get: jest.fn((key: string) =>
          key === 'R2_ENDPOINT' ? 'http://production-rustfs:9000' : undefined,
        ),
        getOrThrow: jest.fn(),
      }),
    ).toBe('http://production-rustfs:9000');
  });

  it('falls back to the Cloudflare R2 endpoint when no explicit endpoint is configured', () => {
    expect(
      resolveS3Endpoint({
        get: jest.fn((key) =>
          key === 'R2_ACCOUNT_ID' ? 'account-id' : undefined,
        ),
        getOrThrow: jest.fn(),
      }),
    ).toBe('https://account-id.r2.cloudflarestorage.com');
  });
});

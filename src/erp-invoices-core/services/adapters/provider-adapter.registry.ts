import { Injectable, Logger } from '@nestjs/common';
import { IProviderAdapter } from './provider-adapter.interface';

@Injectable()
export class ProviderAdapterRegistry {
  private readonly logger = new Logger(ProviderAdapterRegistry.name);
  private readonly adapters = new Map<string, IProviderAdapter>();

  public register(adapter: IProviderAdapter): void {
    const key = adapter.providerCode.toUpperCase();
    this.adapters.set(key, adapter);
    this.logger.log(`Registered original PDF provider adapter: ${key}`);
  }

  public getAdapter(providerCode: string): IProviderAdapter | undefined {
    if (!providerCode) return undefined;
    return this.adapters.get(providerCode.toUpperCase());
  }

  public hasAdapter(providerCode: string): boolean {
    if (!providerCode) return false;
    return this.adapters.has(providerCode.toUpperCase());
  }

  public getSupportedProviders(): string[] {
    return Array.from(this.adapters.keys());
  }
}

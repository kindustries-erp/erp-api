export interface BankContract {
  code: string;
  shortName: string;
  name: string;
  bin: string;
  logoUrl?: string | null;
  aliases?: string[];
  isActive: boolean;
  transferSupported?: boolean;
  lookupSupported?: boolean;
  syncedAt?: Date | null;
}

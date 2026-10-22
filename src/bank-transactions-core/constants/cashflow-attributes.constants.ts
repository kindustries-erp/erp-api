export const CASHFLOW_CLASSIFICATIONS = [
  'OPERATING',
  'INVESTING',
  'FINANCING',
  'OTHER',
] as const;

export type CashflowClassification = (typeof CASHFLOW_CLASSIFICATIONS)[number];

export const CASHFLOW_PURPOSES = [
  'CUSTOMER_PAYMENT',
  'SUPPLIER_PAYMENT',
  'SALARY',
  'TAX',
  'LOAN',
  'OPEX',
  'ASSET_PURCHASE',
  'ASSET_DISPOSAL',
  'INVESTMENT',
  'CAPITAL',
  'INTERNAL_TRANSFER',
  'OTHER',
] as const;

export type CashflowPurpose = (typeof CASHFLOW_PURPOSES)[number];

export const CASHFLOW_PURPOSES_BY_CLASSIFICATION: Record<
  CashflowClassification,
  readonly CashflowPurpose[]
> = {
  OPERATING: [
    'CUSTOMER_PAYMENT',
    'SUPPLIER_PAYMENT',
    'SALARY',
    'TAX',
    'OPEX',
    'OTHER',
  ],
  INVESTING: ['ASSET_PURCHASE', 'ASSET_DISPOSAL', 'INVESTMENT', 'OTHER'],
  FINANCING: ['LOAN', 'CAPITAL', 'OTHER'],
  OTHER: ['INTERNAL_TRANSFER', 'OTHER'],
};

export const isPurposeAllowed = (
  classification: CashflowClassification | null | undefined,
  purpose: CashflowPurpose | null | undefined,
): boolean => {
  if (!purpose) return true;
  if (!classification) return false;
  return CASHFLOW_PURPOSES_BY_CLASSIFICATION[classification].includes(purpose);
};

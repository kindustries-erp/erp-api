export class PortalInvoiceDto {
  nbmst: string;
  nbten: string;
  mst: string;
  shdon: string;
  khhdon: string;
  khmshdon?: string;
  tdlap: string;
  ttcktmai: number;
  tgtcthue: number;
  tsuattue: number | string;
  tgtthue: number;
  tgtttbso: number;
  tthai: number;
}

export class PortalFetchDto {
  token: string;
  dateFrom: string;
  dateTo: string;
  type?: 'purchase' | 'sale';
}

export class PortalImportDto {
  token: string;
  items: PortalInvoiceDto[];
  direction: 'IN' | 'OUT';
}

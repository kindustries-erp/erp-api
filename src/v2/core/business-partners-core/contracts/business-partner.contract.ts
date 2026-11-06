export type PartnerType = 'CUSTOMER' | 'VENDOR' | string;
export type PartnerStatus = 'ACTIVE' | 'INACTIVE' | string;

export interface IBusinessPartner {
  id?: string;
  code: string;
  name: string;
  displayName?: string | null;
  partnerType: PartnerType;
  taxCode?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactName?: string | null;
  status: PartnerStatus;
  notes?: string | null;
  isDeleted?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IBusinessPartnerOption {
  partnerId: string;
  code: string;
  name: string;
  taxCode: string | null;
  partnerType: string;
  source: 'MASTER' | 'INVOICE';
}

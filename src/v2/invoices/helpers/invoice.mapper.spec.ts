import { Invoice } from '../entities/invoice.entity';
import { toInvoiceEntityFields, toInvoiceResponse } from './invoice.mapper';

describe('Invoice mapper', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const entity = {
    id: 'id-1',
    branchId: null,
    invoiceNo: 'sample',
    invoiceNoNormalized: null,
    serialNo: 'sample',
    invoiceDate: 'sample',
    direction: 'sample',
    status: 'sample',
    sellerName: 'sample',
    sellerTaxCode: 'sample',
    buyerName: 'sample',
    buyerTaxCode: 'sample',
    sellerAddress: null,
    buyerAddress: null,
    description: 'sample',
    invoiceType: 'sample',
    invoiceCategory: 'sample',
    preVatAmount: '12.50',
    vatRate: '12.50',
    vatAmount: '12.50',
    discountAmount: '12.50',
    totalAmount: '12.50',
    notes: 'sample',
    branchIds: ['branch-1'],
    categoryId: 'category-1',
    isValid: true,
    postingStatus: 'UNPOSTED',
    pdfFileKey: 'pdf/key.pdf',
    xmlFileKey: 'xml/key.xml',
    effectiveData: { isAdjusted: false },
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  } as unknown as Invoice;

  it('maps the entity to the response DTO without isDeleted', () => {
    expect(toInvoiceResponse(entity)).toEqual({
      id: 'id-1',
      invoiceNo: 'sample',
      serialNo: 'sample',
      invoiceDate: 'sample',
      direction: 'sample',
      status: 'sample',
      sellerName: 'sample',
      sellerTaxCode: 'sample',
      buyerName: 'sample',
      buyerTaxCode: 'sample',
      description: 'sample',
      invoiceType: 'sample',
      invoiceCategory: 'sample',
      preVatAmount: 12.5,
      vatRate: 12.5,
      vatAmount: 12.5,
      discountAmount: 12.5,
      totalAmount: 12.5,
      notes: 'sample',
      branchIds: ['branch-1'],
      categoryId: 'category-1',
      isValid: true,
      postingStatus: 'UNPOSTED',
      pdfFileKey: 'pdf/key.pdf',
      xmlFileKey: 'xml/key.xml',
      effectiveData: { isAdjusted: false },
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('converts DTO input to entity fields', () => {
    expect(
      toInvoiceEntityFields({
        invoiceNo: 'sample',
        serialNo: 'sample',
        invoiceDate: 'sample',
        direction: 'sample',
        status: 'sample',
        sellerName: 'sample',
        sellerTaxCode: 'sample',
        buyerName: 'sample',
        buyerTaxCode: 'sample',
        description: 'sample',
        invoiceType: 'sample',
        invoiceCategory: 'sample',
        preVatAmount: 12.5,
        vatRate: 12.5,
        vatAmount: 12.5,
        discountAmount: 12.5,
        totalAmount: 12.5,
        notes: 'sample',
      }),
    ).toEqual({
      invoiceNo: 'sample',
      serialNo: 'sample',
      invoiceDate: 'sample',
      direction: 'sample',
      status: 'sample',
      sellerName: 'sample',
      sellerTaxCode: 'sample',
      buyerName: 'sample',
      buyerTaxCode: 'sample',
      description: 'sample',
      invoiceType: 'sample',
      invoiceCategory: 'sample',
      preVatAmount: '12.5',
      vatRate: '12.5',
      vatAmount: '12.5',
      discountAmount: '12.5',
      totalAmount: '12.5',
      notes: 'sample',
    });
  });

  it('keeps only the keys that were provided', () => {
    expect(toInvoiceEntityFields({})).toEqual({});
  });
});

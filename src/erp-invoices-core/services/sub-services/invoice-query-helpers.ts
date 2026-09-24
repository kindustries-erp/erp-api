import { EntityManager } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../../../common/utils/query-builder.util';

export function getExcelColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

export async function _loadNetOffAmounts(
  manager: EntityManager,
  invoices: ErpInvoice[],
): Promise<any[]> {
  if (invoices.length === 0) return invoices;
  const ids = invoices.map((i) => i.id);
  const qb = manager
    .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
    .select('netoff.invoice_id', 'invoiceId')
    .addSelect('netoff.net_off_amount', 'netOffAmount')
    .addSelect('bt.reference_number', 'refNo')
    .addSelect('bt.trans_date', 'transDate')
    .addSelect('bt.description', 'description')
    .addSelect('bt.accounting_description', 'accountingDescription')
    .addSelect('bt.debit_amount', 'debitAmount')
    .addSelect('bt.credit_amount', 'creditAmount')
    .leftJoin(
      'erp_bank_transactions',
      'bt',
      'bt.id = netoff.bank_transaction_id',
    )
    .where('netoff.invoice_id IN (:...ids)', { ids });

  if (typeof (qb as any).orderBy === 'function') {
    (qb as any).orderBy('bt.trans_date', 'ASC');
  }
  if (typeof (qb as any).addOrderBy === 'function') {
    (qb as any).addOrderBy('netoff.created_at', 'ASC');
  }

  const rawRows = (await qb.getRawMany()) || [];

  const netOffMap: Record<
    string,
    {
      sum: number;
      refNos: string[];
      transDates: string[];
      descriptions: string[];
      refAmounts: number[];
      details: Array<{
        refNo: string;
        transDate: string;
        description: string;
        refAmount: number;
        netOffAmount: number;
      }>;
    }
  > = {};

  for (const row of rawRows) {
    const invId = row.invoiceId;
    if (!netOffMap[invId]) {
      netOffMap[invId] = {
        sum: 0,
        refNos: [],
        transDates: [],
        descriptions: [],
        refAmounts: [],
        details: [],
      };
    }

    const netOffAmt = Number(row.netOffAmount ?? row.sum) || 0;
    const debitAmt = Number(row.debitAmount) || 0;
    const creditAmt = Number(row.creditAmount) || 0;
    const refAmt = debitAmt > 0 ? debitAmt : creditAmt;

    const refNo = row.refNo
      ? String(row.refNo).trim()
      : row.refNos
        ? String(row.refNos).trim()
        : '';
    let transDateStr = '';
    if (row.transDate) {
      if (typeof row.transDate === 'string') {
        transDateStr = row.transDate.substring(0, 10);
      } else if (row.transDate instanceof Date) {
        const y = row.transDate.getFullYear();
        const m = String(row.transDate.getMonth() + 1).padStart(2, '0');
        const d = String(row.transDate.getDate()).padStart(2, '0');
        transDateStr = `${y}-${m}-${d}`;
      }
    }

    const desc = (row.accountingDescription || row.description || '')
      .toString()
      .trim();

    netOffMap[invId].sum += netOffAmt;
    if (refNo && !netOffMap[invId].refNos.includes(refNo)) {
      netOffMap[invId].refNos.push(refNo);
    }
    if (transDateStr && !netOffMap[invId].transDates.includes(transDateStr)) {
      netOffMap[invId].transDates.push(transDateStr);
    }
    if (desc && !netOffMap[invId].descriptions.includes(desc)) {
      netOffMap[invId].descriptions.push(desc);
    }
    if (refAmt > 0 && !netOffMap[invId].refAmounts.includes(refAmt)) {
      netOffMap[invId].refAmounts.push(refAmt);
    }

    netOffMap[invId].details.push({
      refNo,
      transDate: transDateStr,
      description: desc,
      refAmount: refAmt,
      netOffAmount: netOffAmt,
    });
  }

  return invoices.map((i) => {
    const data = netOffMap[i.id];
    return {
      ...i,
      netOffAmount: String(data?.sum || 0),
      netOffReferences: (data?.refNos || []).join(', '),
      netOffTransDate: (data?.transDates || []).join(', '),
      netOffTransDesc: (data?.descriptions || []).join(' | '),
      netOffRefAmount:
        data?.refAmounts && data.refAmounts.length > 0
          ? data.refAmounts.length === 1
            ? data.refAmounts[0]
            : data.refAmounts.reduce((a, b) => a + b, 0)
          : 0,
      netOffDetails: data?.details || [],
    };
  });
}

export function _mapSortByToQbColumn(
  sortBy: string,
  direction?: string,
): string | null {
  const map: Record<string, string> = {
    invoiceNo: 'inv.invoiceNo',
    totalAmount: 'inv.totalAmount',
    sellerName: 'inv.sellerName',
    buyerName: 'inv.buyerName',
    status: 'inv.status',
    invoiceDate: 'inv.invoiceDate',
    serialNo: 'inv.serialNo',
    description: 'inv.description',
    preVatAmount: 'inv.preVatAmount',
    vatRate: 'inv.vatRate',
    vatAmount: 'inv.vatAmount',
    discountAmount: 'inv.discountAmount',
    licensePlate: 'inv.licensePlate',
    settlementOrder: 'inv.settlementOrder',
    branchId: 'inv.branchId',
    netOffAmount: 'COALESCE(netoff_agg.net_off_sum, 0)',
    remainingAmount: '(inv.total_amount - COALESCE(netoff_agg.net_off_sum, 0))',
  };
  if (sortBy === 'partner')
    return direction === 'IN' ? 'inv.sellerName' : 'inv.buyerName';
  if (sortBy === 'taxCode')
    return direction === 'IN' ? 'inv.sellerTaxCode' : 'inv.buyerTaxCode';
  return map[sortBy] ?? null;
}

export function _applyColumnSearch(
  qb: any,
  columnSearch: Record<string, string>,
  direction?: string,
) {
  Object.keys(columnSearch).forEach((key) => {
    const val = columnSearch[key];
    if (!val) return;

    if (key === 'invoiceNo') {
      applyMultiKeywordMultiFieldFilter(
        qb,
        ['inv.invoice_no', 'inv.serial_no'],
        val,
        'invoiceNoSearch',
      );
    } else if (key === 'serialNo') {
      applyMultiKeywordFilter(qb, 'inv.serial_no', val, 'serialNoSearch');
    } else if (key === 'partner') {
      if (direction === 'IN') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.seller_name', 'inv.seller_tax_code'],
          val,
          'partnerSearch',
        );
      } else if (direction === 'OUT') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.buyer_name', 'inv.buyer_personal_name', 'inv.buyer_tax_code'],
          val,
          'partnerSearch',
        );
      } else {
        applyMultiKeywordMultiFieldFilter(
          qb,
          [
            'inv.seller_name',
            'inv.seller_tax_code',
            'inv.buyer_name',
            'inv.buyer_personal_name',
            'inv.buyer_tax_code',
          ],
          val,
          'partnerSearch',
        );
      }
    } else if (key === 'taxCode') {
      if (direction === 'IN') {
        applyMultiKeywordFilter(
          qb,
          'inv.seller_tax_code',
          val,
          'taxCodeSearch',
        );
      } else if (direction === 'OUT') {
        applyMultiKeywordFilter(qb, 'inv.buyer_tax_code', val, 'taxCodeSearch');
      } else {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.seller_tax_code', 'inv.buyer_tax_code'],
          val,
          'taxCodeSearch',
        );
      }
    } else if (key === 'description') {
      applyMultiKeywordFilter(qb, 'inv.description', val, 'descSearch');
    } else if (key === 'preVatAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(inv.pre_vat_amount AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'preVatSearch',
      );
    } else if (key === 'vatRate') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(inv.vat_rate AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'vatRateSearch',
      );
    } else if (key === 'vatAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(inv.vat_amount AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'vatSearch',
      );
    } else if (key === 'discountAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(inv.discount_amount AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'discountSearch',
      );
    } else if (key === 'totalAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(inv.total_amount AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'totalSearch',
      );
    } else if (key === 'netOffAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(COALESCE(netoff_agg.net_off_sum, 0) AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'netOffSearch',
      );
    } else if (key === 'remainingAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST((inv.total_amount - COALESCE(netoff_agg.net_off_sum, 0)) AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'remainingSearch',
      );
    } else if (key === 'settlementOrder') {
      applyMultiKeywordFilter(
        qb,
        'inv.settlement_order',
        val,
        'settlementSearch',
      );
    } else if (key === 'licensePlate') {
      applyMultiKeywordFilter(qb, 'inv.license_plate', val, 'plateSearch');
    } else if (key === 'notes') {
      applyMultiKeywordFilter(qb, 'inv.notes', val, 'notesSearch');
    } else if (key === 'branchId' || key === 'branchName') {
      applyMultiKeywordFilter(qb, 'inv.branch_id', val, 'branchIdSearch');
    } else if (key === 'status') {
      applyMultiKeywordFilter(qb, 'inv.status', val, 'statusSearch');
    } else if (key === 'postingStatus') {
      applyMultiKeywordFilter(
        qb,
        'inv.posting_status',
        val,
        'postingStatusSearch',
      );
    } else if (key === 'taxInvoiceStatus') {
      applyMultiKeywordFilter(
        qb,
        'CAST(inv.tax_invoice_status AS TEXT)',
        val,
        'taxInvoiceStatusSearch',
      );
    } else if (key === 'invoiceDate') {
      const rawKw = String(val);
      if (rawKw.includes('|')) {
        const [from, to] = rawKw.split('|');
        if (from && to) {
          qb.andWhere(
            `inv.invoice_date >= :from_invDate AND inv.invoice_date <= :to_invDate`,
            { from_invDate: from, to_invDate: to + ' 23:59:59' },
          );
        } else if (from) {
          qb.andWhere(`inv.invoice_date >= :from_invDate`, {
            from_invDate: from,
          });
        } else if (to) {
          qb.andWhere(`inv.invoice_date <= :to_invDate`, {
            to_invDate: to + ' 23:59:59',
          });
        }
      } else {
        applyMultiKeywordFilter(
          qb,
          "TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')",
          val,
          'invoiceDateSearch',
        );
      }
    }
  });
}

export function _applyColumnFilters(
  qb: any,
  columnFilters: Record<string, string[]>,
  direction?: string,
) {
  Object.keys(columnFilters).forEach((key) => {
    const vals = columnFilters[key];
    if (!vals || vals.length === 0) return;

    if (vals[0] === '__ALL_MATCHING__') {
      const searchStr = vals[1] || '';
      if (searchStr) {
        _applyColumnSearch(qb, { [key]: searchStr }, direction);
      }
      return;
    }

    if (key === 'status')
      qb.andWhere('inv.status IN (:...statusVals)', { statusVals: vals });
    else if (key === 'postingStatus')
      qb.andWhere('inv.posting_status IN (:...postingStatusVals)', {
        postingStatusVals: vals,
      });
    else if (key === 'branchId') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          '(inv.branch_id IN (:...branchVals) OR inv.branch_id IS NULL)',
          { branchVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere('(inv.branch_id IS NULL)');
      } else {
        qb.andWhere('inv.branch_id IN (:...branchVals)', {
          branchVals: vals,
        });
      }
    } else if (key === 'invoiceDate')
      qb.andWhere(
        `TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') IN (:...invoiceDateVals)`,
        { invoiceDateVals: vals },
      );
    else if (key === 'serialNo')
      qb.andWhere('inv.serial_no IN (:...serialNoVals)', {
        serialNoVals: vals,
      });
    else if (key === 'invoiceNo') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      const conds: string[] = [];
      const params: Record<string, any> = {};
      const simpleVals: string[] = [];

      realVals.forEach((v, idx) => {
        if (v.includes(':::')) {
          const [invNo, serNo] = v.split(':::');
          conds.push(
            `(TRIM(inv.invoice_no) = :invNo_${idx} AND TRIM(inv.serial_no) = :serNo_${idx})`,
          );
          params[`invNo_${idx}`] = invNo.trim();
          params[`serNo_${idx}`] = serNo.trim();
        } else {
          simpleVals.push(v.trim());
        }
      });

      if (simpleVals.length > 0) {
        conds.push(
          '(TRIM(inv.invoice_no) IN (:...simpleInvoiceNos) OR TRIM(inv.serial_no) IN (:...simpleInvoiceNos))',
        );
        params['simpleInvoiceNos'] = simpleVals;
      }

      if (hasBlank) {
        conds.push(
          "(inv.invoice_no IS NULL OR CAST(inv.invoice_no AS TEXT) = '')",
        );
      }

      if (conds.length > 0) {
        qb.andWhere(`(${conds.join(' OR ')})`, params);
      }
    } else if (key === 'partner') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      const nameField =
        direction === 'IN'
          ? 'inv.seller_name'
          : direction === 'OUT'
            ? "COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name)"
            : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_name ELSE COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name) END)";
      const taxField =
        direction === 'IN'
          ? 'inv.seller_tax_code'
          : direction === 'OUT'
            ? 'inv.buyer_tax_code'
            : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code ELSE inv.buyer_tax_code END)";

      const conds: string[] = [];
      const params: Record<string, any> = {};
      const simpleVals: string[] = [];

      realVals.forEach((v, idx) => {
        if (v.includes(':::')) {
          const [tax, name] = v.split(':::');
          if (tax && name) {
            conds.push(
              `(TRIM(${taxField}) = :partnerTax_${idx} OR TRIM(${nameField}) ILIKE :partnerName_${idx})`,
            );
            params[`partnerTax_${idx}`] = tax.trim();
            params[`partnerName_${idx}`] = `%${name.trim()}%`;
          } else if (tax) {
            conds.push(`TRIM(${taxField}) = :partnerTax_${idx}`);
            params[`partnerTax_${idx}`] = tax.trim();
          } else if (name) {
            conds.push(`TRIM(${nameField}) ILIKE :partnerName_${idx}`);
            params[`partnerName_${idx}`] = `%${name.trim()}%`;
          }
        } else {
          simpleVals.push(v.trim());
        }
      });

      if (simpleVals.length > 0) {
        conds.push(
          `(TRIM(${nameField}) IN (:...simplePartners) OR TRIM(${taxField}) IN (:...simplePartners))`,
        );
        params['simplePartners'] = simpleVals;
      }

      if (hasBlank) {
        conds.push(`(${nameField} IS NULL OR CAST(${nameField} AS TEXT) = '')`);
      }

      if (conds.length > 0) {
        qb.andWhere(`(${conds.join(' OR ')})`, params);
      }
    } else if (key === 'taxCode') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      const fieldMap: any = {
        IN: 'inv.seller_tax_code',
        OUT: 'inv.buyer_tax_code',
      };
      const field = direction
        ? fieldMap[direction]
        : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code END)";

      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          `(${field} IN (:...taxCodeVals) OR ${field} IS NULL OR CAST(${field} AS TEXT) = '')`,
          { taxCodeVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere(`(${field} IS NULL OR CAST(${field} AS TEXT) = '')`);
      } else {
        qb.andWhere(`${field} IN (:...taxCodeVals)`, { taxCodeVals: vals });
      }
    } else if (key === 'description') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          "(inv.description IN (:...descVals) OR inv.description IS NULL OR inv.description = '')",
          { descVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere("(inv.description IS NULL OR inv.description = '')");
      } else {
        qb.andWhere('inv.description IN (:...descVals)', { descVals: vals });
      }
    } else if (key === 'notes') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          "(inv.notes IN (:...notesVals) OR inv.notes IS NULL OR inv.notes = '')",
          { notesVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere("(inv.notes IS NULL OR inv.notes = '')");
      } else {
        qb.andWhere('inv.notes IN (:...notesVals)', { notesVals: vals });
      }
    } else if (key === 'isValid') {
      const validFilter = vals.includes('true') || vals.includes('1');
      const invalidFilter = vals.includes('false') || vals.includes('0');
      if (validFilter && !invalidFilter) qb.andWhere('inv.is_valid = true');
      else if (invalidFilter && !validFilter)
        qb.andWhere('inv.is_valid = false');
    } else if (key === 'preVatAmount') {
      qb.andWhere('CAST(inv.pre_vat_amount AS TEXT) IN (:...preVatVals)', {
        preVatVals: vals,
      });
    } else if (key === 'vatRate') {
      qb.andWhere('CAST(inv.vat_rate AS TEXT) IN (:...vatRateVals)', {
        vatRateVals: vals,
      });
    } else if (key === 'vatAmount') {
      qb.andWhere('CAST(inv.vat_amount AS TEXT) IN (:...vatVals)', {
        vatVals: vals,
      });
    } else if (key === 'discountAmount') {
      qb.andWhere('CAST(inv.discount_amount AS TEXT) IN (:...discountVals)', {
        discountVals: vals,
      });
    } else if (key === 'totalAmount') {
      qb.andWhere('CAST(inv.total_amount AS TEXT) IN (:...totalVals)', {
        totalVals: vals,
      });
    } else if (key === 'settlementOrder')
      qb.andWhere('inv.settlement_order IN (:...settleVals)', {
        settleVals: vals,
      });
    else if (key === 'licensePlate')
      qb.andWhere('inv.license_plate IN (:...plateVals)', {
        plateVals: vals,
      });
    else if (key === 'attachments') {
      const conditions: string[] = [];
      if (vals.includes('has_pdf'))
        conditions.push(
          "(inv.pdf_file_key IS NOT NULL OR (inv.pdf_files IS NOT NULL AND inv.pdf_files::text != '[]' AND inv.pdf_files::text != 'null') OR EXISTS (SELECT 1 FROM erp_invoice_attachments eia JOIN erp_attachments ea ON eia.attachment_id = ea.id WHERE eia.invoice_id = inv.id AND ea.mime_type = 'application/pdf'))",
        );
      if (vals.includes('has_xml'))
        conditions.push('inv.xml_file_key IS NOT NULL');
      if (vals.includes('no_pdf'))
        conditions.push(
          "(inv.pdf_file_key IS NULL AND (inv.pdf_files IS NULL OR inv.pdf_files::text = '[]' OR inv.pdf_files::text = 'null') AND NOT EXISTS (SELECT 1 FROM erp_invoice_attachments eia JOIN erp_attachments ea ON eia.attachment_id = ea.id WHERE eia.invoice_id = inv.id AND ea.mime_type = 'application/pdf'))",
        );
      if (vals.includes('no_xml')) conditions.push('inv.xml_file_key IS NULL');
      if (conditions.length > 0) qb.andWhere(`(${conditions.join(' OR ')})`);
    } else if (key === 'taxInvoiceType')
      qb.andWhere('inv.tax_invoice_type IN (:...taxInvoiceTypeVals)', {
        taxInvoiceTypeVals: vals,
      });
    else if (key === 'taxInvoiceStatus') {
      const numericVals = vals
        .map((v) => parseInt(v, 10))
        .filter((v) => !isNaN(v));
      const includeNull = vals.includes('null') || vals.includes('NULL');
      if (numericVals.length > 0 && includeNull) {
        qb.andWhere(
          '(inv.tax_invoice_status IN (:...taxInvoiceStatusVals) OR inv.tax_invoice_status IS NULL)',
          { taxInvoiceStatusVals: numericVals },
        );
      } else if (numericVals.length > 0) {
        qb.andWhere('inv.tax_invoice_status IN (:...taxInvoiceStatusVals)', {
          taxInvoiceStatusVals: numericVals,
        });
      } else if (includeNull) {
        qb.andWhere('inv.tax_invoice_status IS NULL');
      }
    } else if (key === 'taxProcessStatus') {
      qb.andWhere('inv.tax_process_status IN (:...taxProcessStatusVals)', {
        taxProcessStatusVals: vals
          .map((v) => parseInt(v, 10))
          .filter((v) => !isNaN(v)),
      });
    } else if (key === 'relatedInvoiceNo' || key === 'related_invoice_no') {
      qb.andWhere('inv.related_invoice_no IN (:...relInvNoVals)', {
        relInvNoVals: vals,
      });
    } else if (key === 'relatedSerialNo' || key === 'related_serial_no') {
      qb.andWhere('inv.related_serial_no IN (:...relSerialNoVals)', {
        relSerialNoVals: vals,
      });
    } else if (key === 'netOffAmount' || key === 'remainingAmount') {
      const conditions: string[] = [];
      if (vals.includes('settled_full'))
        conditions.push(
          '(COALESCE(netoff_agg.net_off_sum, 0) > 0 AND inv.total_amount <= COALESCE(netoff_agg.net_off_sum, 0))',
        );
      if (vals.includes('settled_partial'))
        conditions.push(
          '(COALESCE(netoff_agg.net_off_sum, 0) > 0 AND inv.total_amount > COALESCE(netoff_agg.net_off_sum, 0))',
        );
      if (vals.includes('unsettled'))
        conditions.push('(COALESCE(netoff_agg.net_off_sum, 0) = 0)');

      if (conditions.length > 0) qb.andWhere(`(${conditions.join(' OR ')})`);
    }
  });
}

export function _applyColumnFiltersExport(
  qb: any,
  columnFilters: Record<string, string[]>,
  direction?: string,
) {
  _applyColumnFilters(qb, columnFilters, direction);
}

import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../../../common/utils/query-builder.util';

export function _applyItemColumnSearch(
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
        'itemInvoiceNoSearch',
      );
    } else if (key === 'serialNo') {
      applyMultiKeywordFilter(qb, 'inv.serial_no', val, 'itemSerialNoSearch');
    } else if (key === 'partner') {
      if (direction === 'IN') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.seller_name', 'inv.seller_tax_code'],
          val,
          'itemPartnerSearch',
        );
      } else if (direction === 'OUT') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.buyer_name', 'inv.buyer_personal_name', 'inv.buyer_tax_code'],
          val,
          'itemPartnerSearch',
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
          'itemPartnerSearch',
        );
      }
    } else if (key === 'taxCode') {
      if (direction === 'IN') {
        applyMultiKeywordFilter(
          qb,
          'inv.seller_tax_code',
          val,
          'itemTaxCodeSearch',
        );
      } else if (direction === 'OUT') {
        applyMultiKeywordFilter(
          qb,
          'inv.buyer_tax_code',
          val,
          'itemTaxCodeSearch',
        );
      } else {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.seller_tax_code', 'inv.buyer_tax_code'],
          val,
          'itemTaxCodeSearch',
        );
      }
    } else if (key === 'itemCode') {
      applyMultiKeywordFilter(qb, 'ii.item_code', val, 'itemCodeSearch');
    } else if (key === 'description') {
      applyMultiKeywordFilter(qb, 'ii.description', val, 'itemDescSearch');
    } else if (key === 'unit') {
      applyMultiKeywordFilter(qb, 'ii.unit', val, 'itemUnitSearch');
    } else if (key === 'quantity') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(ii.quantity AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'itemQtySearch',
      );
    } else if (key === 'unitPrice') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(ii.unit_price AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'itemUnitPriceSearch',
      );
    } else if (key === 'preVatAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(ii.pre_vat_amount AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'itemPreVatSearch',
      );
    } else if (key === 'vatRate') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(ii.vat_rate AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'itemVatRateSearch',
      );
    } else if (key === 'vatAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(ii.vat_amount AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'itemVatAmountSearch',
      );
    } else if (key === 'discountAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(ii.discount_amount AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'itemDiscountSearch',
      );
    } else if (key === 'totalAmount') {
      applyMultiKeywordFilter(
        qb,
        "REPLACE(REPLACE(CAST(ii.total_amount AS TEXT), '.', ''), ',', '')",
        val.replace(/[,.]/g, ''),
        'itemTotalSearch',
      );
    } else if (key === 'invoiceSubcategory') {
      applyMultiKeywordFilter(
        qb,
        'ii.invoice_subcategory',
        val,
        'itemSubcatSearch',
      );
    } else if (key === 'status') {
      applyMultiKeywordFilter(qb, 'inv.status', val, 'itemStatusSearch');
    } else if (key === 'postingStatus') {
      applyMultiKeywordFilter(
        qb,
        'inv.posting_status',
        val,
        'itemPostingStatusSearch',
      );
    } else if (key === 'taxInvoiceStatus') {
      applyMultiKeywordFilter(
        qb,
        'CAST(inv.tax_invoice_status AS TEXT)',
        val,
        'itemTaxInvoiceStatusSearch',
      );
    } else if (key === 'branchId' || key === 'branchName') {
      applyMultiKeywordMultiFieldFilter(
        qb,
        ['inv.branch_id', 'b.name', 'b.code'],
        val,
        'itemBranchSearch',
      );
    } else if (key === 'licensePlate') {
      applyMultiKeywordFilter(qb, 'inv.license_plate', val, 'itemPlateSearch');
    } else if (key === 'settlementOrder') {
      applyMultiKeywordFilter(
        qb,
        'inv.settlement_order',
        val,
        'itemSettlementSearch',
      );
    } else if (key === 'invoiceDate') {
      const rawKw = String(val);
      if (rawKw.includes('|')) {
        const [from, to] = rawKw.split('|');
        if (from && to) {
          qb.andWhere(
            `inv.invoice_date >= :item_from_invDate AND inv.invoice_date <= :item_to_invDate`,
            {
              item_from_invDate: from,
              item_to_invDate: to + ' 23:59:59',
            },
          );
        } else if (from) {
          qb.andWhere(`inv.invoice_date >= :item_from_invDate`, {
            item_from_invDate: from,
          });
        } else if (to) {
          qb.andWhere(`inv.invoice_date <= :item_to_invDate`, {
            item_to_invDate: to + ' 23:59:59',
          });
        }
      } else {
        applyMultiKeywordFilter(
          qb,
          "TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')",
          val,
          'itemInvoiceDateSearch',
        );
      }
    }
  });
}

export function _applyItemColumnFilters(
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
        _applyItemColumnSearch(qb, { [key]: searchStr }, direction);
      }
      return;
    }

    if (key === 'invoiceNo') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      const conds: string[] = [];
      const params: Record<string, any> = {};
      const simpleVals: string[] = [];

      realVals.forEach((v, idx) => {
        if (v.includes(':::')) {
          const [invNo, serNo] = v.split(':::');
          conds.push(
            `(TRIM(inv.invoice_no) = :item_invNo_${idx} AND TRIM(inv.serial_no) = :item_serNo_${idx})`,
          );
          params[`item_invNo_${idx}`] = invNo.trim();
          params[`item_serNo_${idx}`] = serNo.trim();
        } else {
          simpleVals.push(v.trim());
        }
      });

      if (simpleVals.length > 0) {
        conds.push(
          '(TRIM(inv.invoice_no) IN (:...itemSimpleInvoiceNos) OR TRIM(inv.serial_no) IN (:...itemSimpleInvoiceNos))',
        );
        params['itemSimpleInvoiceNos'] = simpleVals;
      }

      if (hasBlank) {
        conds.push(
          "(inv.invoice_no IS NULL OR CAST(inv.invoice_no AS TEXT) = '')",
        );
      }

      if (conds.length > 0) {
        qb.andWhere(`(${conds.join(' OR ')})`, params);
      }
    } else if (key === 'serialNo') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          "(inv.serial_no IN (:...item_serVals) OR inv.serial_no IS NULL OR inv.serial_no = '')",
          { item_serVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere("(inv.serial_no IS NULL OR inv.serial_no = '')");
      } else {
        qb.andWhere('inv.serial_no IN (:...item_serVals)', {
          item_serVals: vals,
        });
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
              `(TRIM(${taxField}) = :itemPartnerTax_${idx} OR TRIM(${nameField}) ILIKE :itemPartnerName_${idx})`,
            );
            params[`itemPartnerTax_${idx}`] = tax.trim();
            params[`itemPartnerName_${idx}`] = `%${name.trim()}%`;
          } else if (tax) {
            conds.push(`TRIM(${taxField}) = :itemPartnerTax_${idx}`);
            params[`itemPartnerTax_${idx}`] = tax.trim();
          } else if (name) {
            conds.push(`TRIM(${nameField}) ILIKE :itemPartnerName_${idx}`);
            params[`itemPartnerName_${idx}`] = `%${name.trim()}%`;
          }
        } else {
          simpleVals.push(v.trim());
        }
      });

      if (simpleVals.length > 0) {
        conds.push(
          `(TRIM(${nameField}) IN (:...itemSimplePartners) OR TRIM(${taxField}) IN (:...itemSimplePartners))`,
        );
        params['itemSimplePartners'] = simpleVals;
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
      const field =
        direction === 'IN'
          ? 'inv.seller_tax_code'
          : direction === 'OUT'
            ? 'inv.buyer_tax_code'
            : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code ELSE inv.buyer_tax_code END)";

      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          `(${field} IN (:...itemTaxCodeVals) OR ${field} IS NULL OR CAST(${field} AS TEXT) = '')`,
          { itemTaxCodeVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere(`(${field} IS NULL OR CAST(${field} AS TEXT) = '')`);
      } else {
        qb.andWhere(`${field} IN (:...itemTaxCodeVals)`, {
          itemTaxCodeVals: vals,
        });
      }
    } else if (key === 'itemCode') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          "(ii.item_code IN (:...itemCodeVals) OR ii.item_code IS NULL OR ii.item_code = '')",
          { itemCodeVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere("(ii.item_code IS NULL OR ii.item_code = '')");
      } else {
        qb.andWhere('ii.item_code IN (:...itemCodeVals)', {
          itemCodeVals: vals,
        });
      }
    } else if (key === 'description') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          "(ii.description IN (:...itemDescVals) OR ii.description IS NULL OR ii.description = '')",
          { itemDescVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere("(ii.description IS NULL OR ii.description = '')");
      } else {
        qb.andWhere('ii.description IN (:...itemDescVals)', {
          itemDescVals: vals,
        });
      }
    } else if (key === 'unit') {
      const hasBlank = vals.includes('__BLANK__');
      const realVals = vals.filter((v) => v !== '__BLANK__');
      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          "(ii.unit IN (:...itemUnitVals) OR ii.unit IS NULL OR ii.unit = '')",
          { itemUnitVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere("(ii.unit IS NULL OR ii.unit = '')");
      } else {
        qb.andWhere('ii.unit IN (:...itemUnitVals)', {
          itemUnitVals: vals,
        });
      }
    } else if (key === 'quantity') {
      qb.andWhere('CAST(ii.quantity AS TEXT) IN (:...itemQtyVals)', {
        itemQtyVals: vals,
      });
    } else if (key === 'unitPrice') {
      qb.andWhere('CAST(ii.unit_price AS TEXT) IN (:...itemUnitPriceVals)', {
        itemUnitPriceVals: vals,
      });
    } else if (key === 'preVatAmount') {
      qb.andWhere('CAST(ii.pre_vat_amount AS TEXT) IN (:...itemPreVatVals)', {
        itemPreVatVals: vals,
      });
    } else if (key === 'vatRate') {
      const numericRates = vals.map((v) => Number(v)).filter((v) => !isNaN(v));
      const hasNull = vals.includes('__BLANK__') || vals.includes('null');
      if (numericRates.length > 0 && hasNull) {
        qb.andWhere(
          '(ii.vat_rate IN (:...itemVatRates) OR ii.vat_rate IS NULL)',
          { itemVatRates: numericRates },
        );
      } else if (numericRates.length > 0) {
        qb.andWhere('ii.vat_rate IN (:...itemVatRates)', {
          itemVatRates: numericRates,
        });
      } else if (hasNull) {
        qb.andWhere('ii.vat_rate IS NULL');
      }
    } else if (key === 'vatAmount') {
      qb.andWhere('CAST(ii.vat_amount AS TEXT) IN (:...itemVatAmountVals)', {
        itemVatAmountVals: vals,
      });
    } else if (key === 'discountAmount') {
      qb.andWhere('CAST(ii.discount_amount AS TEXT) IN (:...itemDiscVals)', {
        itemDiscVals: vals,
      });
    } else if (key === 'totalAmount') {
      qb.andWhere('CAST(ii.total_amount AS TEXT) IN (:...itemTotalVals)', {
        itemTotalVals: vals,
      });
    } else if (key === 'invoiceSubcategory') {
      qb.andWhere('ii.invoice_subcategory IN (:...itemSubcatVals)', {
        itemSubcatVals: vals,
      });
    } else if (key === 'status') {
      qb.andWhere('inv.status IN (:...itemStatusVals)', {
        itemStatusVals: vals,
      });
    } else if (key === 'postingStatus') {
      qb.andWhere('inv.posting_status IN (:...itemPostStatusVals)', {
        itemPostStatusVals: vals,
      });
    } else if (key === 'taxInvoiceStatus') {
      const numericVals = vals.map((v) => Number(v)).filter((v) => !isNaN(v));
      const hasNull = vals.includes('__BLANK__') || vals.includes('null');
      if (numericVals.length > 0 && hasNull) {
        qb.andWhere(
          '(inv.tax_invoice_status IN (:...itemTaxStatusVals) OR inv.tax_invoice_status IS NULL)',
          { itemTaxStatusVals: numericVals },
        );
      } else if (numericVals.length > 0) {
        qb.andWhere('inv.tax_invoice_status IN (:...itemTaxStatusVals)', {
          itemTaxStatusVals: numericVals,
        });
      } else if (hasNull) {
        qb.andWhere('inv.tax_invoice_status IS NULL');
      }
    } else if (key === 'branchId' || key === 'branchName') {
      const hasBlank =
        vals.includes('__BLANK__') ||
        vals.includes('null') ||
        vals.includes('');
      const realVals = vals.filter(
        (v) => v !== '__BLANK__' && v !== 'null' && v !== '',
      );
      if (hasBlank && realVals.length > 0) {
        qb.andWhere(
          '(inv.branch_id IN (:...itemBranchVals) OR inv.branch_id IS NULL)',
          { itemBranchVals: realVals },
        );
      } else if (hasBlank) {
        qb.andWhere('inv.branch_id IS NULL');
      } else if (realVals.length > 0) {
        qb.andWhere('inv.branch_id IN (:...itemBranchVals)', {
          itemBranchVals: realVals,
        });
      }
    } else if (key === 'licensePlate') {
      qb.andWhere('inv.license_plate IN (:...itemLpVals)', {
        itemLpVals: vals,
      });
    } else if (key === 'settlementOrder') {
      qb.andWhere('inv.settlement_order IN (:...itemSoVals)', {
        itemSoVals: vals,
      });
    } else if (key === 'invoiceDate') {
      qb.andWhere(
        `TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') IN (:...itemInvDateVals)`,
        { itemInvDateVals: vals },
      );
    }
  });
}

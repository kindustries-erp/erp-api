import { Injectable, Logger } from '@nestjs/common';
import { DOMParser } from '@xmldom/xmldom';

export interface InvoiceProviderLookupInfo {
  providerCode: string;
  providerName: string;
  msttcgp: string | null;
  lookupCode: string | null;
  lookupUrl: string | null;
  extraInfo?: Record<string, string>;
}

const KNOWN_MSTTCGP: Record<
  string,
  { code: string; name: string; url: string }
> = {
  '0101243150': {
    code: 'MISA',
    name: 'MISA meInvoice',
    url: 'https://www.meinvoice.vn/tra-cuu/',
  },
  '0100109106': {
    code: 'VIETTEL',
    name: 'Viettel S-Invoice',
    url: 'https://sinvoice.viettel.vn/tracuuhoadon',
  },
  '0100686209': {
    code: 'VNPT',
    name: 'VNPT Invoice',
    url: 'https://vinvoice.vnpt.vn',
  },
  '0105987432': {
    code: 'EASYINVOICE',
    name: 'Softdreams EasyInvoice',
    url: 'https://tracuu.easyinvoice.vn',
  },
  '0101360697': {
    code: 'BKAV',
    name: 'BKAV eHoadon',
    url: 'https://van.ehoadon.vn/tracuu',
  },
  '0101300842': {
    code: 'THAISON',
    name: 'Thái Sơn E-Invoice',
    url: 'https://einvoice.vn/tra-cuu',
  },
  '0108399589': {
    code: 'CYBERBILL',
    name: 'CyberBill',
    url: 'https://tracuu.cyberbill.vn',
  },
  '0105232093': {
    code: 'CYBERBILL',
    name: 'CyberBill (CyberLotus)',
    url: 'https://tracuu.cyberbill.vn',
  },
  '0101261330': {
    code: 'FPT',
    name: 'FPT.eInvoice',
    url: 'https://tracuu.einvoice.fpt.com.vn',
  },
  '0106026495': {
    code: 'MINVOICE',
    name: 'M-Invoice',
    url: 'https://tracuu.minvoice.com.vn',
  },
};

const VINGROUP_TAX_CODES = ['0100684378', '0108927926', '0108926276'];

@Injectable()
export class InvoiceProviderDetectorService {
  private readonly logger = new Logger(InvoiceProviderDetectorService.name);

  public detectFromXml(
    xmlContent: string,
    sellerTaxCode?: string | null,
  ): InvoiceProviderLookupInfo {
    if (!xmlContent || typeof xmlContent !== 'string') {
      return this.fallbackUnknown(null, null);
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');

      const msttcgp = this.extractTag(doc, 'msttcgp', 'MSTTCGP');
      const salt = this.extractTag(doc, 'salt', 'Salt');
      const fkey = this.extractTag(doc, 'Fkey', 'fkey');
      const portalLink = this.extractTag(doc, 'PortalLink', 'portallink');
      const transactionId = this.extractTag(
        doc,
        'TransactionID',
        'transactionID',
      );
      const reservationCode = this.extractTag(
        doc,
        'ReservationCode',
        'reservationCode',
      );
      const maTraCuu = this.extractTag(doc, 'MaTraCuu', 'matracuu');

      const dlhdonEl = doc.getElementsByTagName
        ? doc.getElementsByTagName('DLHDon')?.[0]
        : null;
      const dlhdonId =
        dlhdonEl?.getAttribute?.('Id') ||
        dlhdonEl?.getAttribute?.('id') ||
        null;

      const extraTtins = this.extractTTKhac(doc);

      // 1. VinFast / Vingroup Detection
      const isVinSeller = sellerTaxCode
        ? VINGROUP_TAX_CODES.some((mst) => sellerTaxCode.startsWith(mst))
        : false;
      if (
        isVinSeller ||
        salt ||
        (maTraCuu && xmlContent.includes('vingroup'))
      ) {
        const lookupCode =
          salt ||
          extraTtins['salt'] ||
          maTraCuu ||
          extraTtins['matracuu'] ||
          null;
        return {
          providerCode: 'VINFAST',
          providerName: 'Vingroup / VinFast E-Invoice',
          msttcgp: msttcgp || null,
          lookupCode,
          lookupUrl: 'https://e-invoice-tt78.vingroup.net/TraCuu/SearchBySalt',
          extraInfo: { salt: salt || '', maTraCuu: maTraCuu || '' },
        };
      }

      // 2. EasyInvoice Detection
      if (
        msttcgp === '0105987432' ||
        portalLink ||
        extraTtins['portallink'] ||
        (fkey && xmlContent.includes('easyinvoice'))
      ) {
        const lookupCode = fkey || extraTtins['fkey'] || null;
        let lookupUrl =
          portalLink ||
          extraTtins['portallink'] ||
          'https://tracuu.easyinvoice.vn';
        if (lookupUrl && !lookupUrl.startsWith('http')) {
          lookupUrl = `https://${lookupUrl}`;
        }
        return {
          providerCode: 'EASYINVOICE',
          providerName: 'Softdreams EasyInvoice',
          msttcgp: msttcgp || '0105987432',
          lookupCode,
          lookupUrl,
          extraInfo: {
            portalLink: portalLink || extraTtins['portallink'] || '',
            fkey: fkey || extraTtins['fkey'] || '',
          },
        };
      }

      // 2.5. HILO / GSM (Taxi Xanh SM) Detection
      const isGsmSeller = sellerTaxCode
        ? sellerTaxCode.startsWith('0110269067')
        : false;
      const hiloKey =
        extraTtins['hilo-searchkey'] ||
        xmlContent
          .match(
            /<TTruong>Hilo-SearchKey<\/TTruong>\s*<KDLieu>[^<]*<\/KDLieu>\s*<DLieu>([^<]+)<\/DLieu>/i,
          )?.[1]
          ?.trim() ||
        null;
      if (
        isGsmSeller ||
        hiloKey ||
        xmlContent.includes('gsm-einvoice.hilo.com.vn')
      ) {
        return {
          providerCode: 'HILO',
          providerName: 'HILO E-Invoice (GSM Xanh SM)',
          msttcgp: msttcgp || null,
          lookupCode: hiloKey,
          lookupUrl: 'https://gsm-einvoice.hilo.com.vn/',
          extraInfo: { searchKey: hiloKey || '' },
        };
      }

      // 3. Known MSTTCGP (MISA, Viettel, VNPT, etc.)
      if (msttcgp && KNOWN_MSTTCGP[msttcgp]) {
        const known = KNOWN_MSTTCGP[msttcgp];
        let lookupCode: string | null = null;
        if (known.code === 'MISA') {
          lookupCode =
            transactionId ||
            extraTtins['transactionid'] ||
            maTraCuu ||
            extraTtins['matracuu'] ||
            null;
        } else if (known.code === 'VIETTEL') {
          lookupCode =
            reservationCode ||
            extraTtins['reservationcode'] ||
            extraTtins['mã số bí mật'] ||
            null;
        } else if (known.code === 'CYBERBILL') {
          const rawId = dlhdonId ? dlhdonId.replace(/^ID-/i, '') : null;
          lookupCode =
            rawId ||
            extraTtins['masobimat'] ||
            extraTtins['mã số bí mật'] ||
            maTraCuu ||
            extraTtins['matracuu'] ||
            null;
        } else {
          lookupCode = fkey || maTraCuu || extraTtins['matracuu'] || null;
        }

        return {
          providerCode: known.code,
          providerName: known.name,
          msttcgp,
          lookupCode,
          lookupUrl: known.url,
          extraInfo: extraTtins,
        };
      }

      // 4. Heuristic Fallback by tag presence
      if (transactionId || xmlContent.includes('meinvoice.vn')) {
        return {
          providerCode: 'MISA',
          providerName: 'MISA meInvoice',
          msttcgp: msttcgp || '0101243150',
          lookupCode: transactionId || extraTtins['transactionid'] || null,
          lookupUrl: 'https://www.meinvoice.vn/tra-cuu/',
          extraInfo: extraTtins,
        };
      }

      if (xmlContent.includes('sinvoice.viettel.vn')) {
        return {
          providerCode: 'VIETTEL',
          providerName: 'Viettel S-Invoice',
          msttcgp: msttcgp || '0100109106',
          lookupCode: reservationCode || extraTtins['reservationcode'] || null,
          lookupUrl: 'https://sinvoice.viettel.vn/tracuuhoadon',
          extraInfo: extraTtins,
        };
      }

      const genericCode =
        maTraCuu ||
        salt ||
        fkey ||
        transactionId ||
        reservationCode ||
        extraTtins['matracuu'] ||
        null;

      return this.fallbackUnknown(msttcgp, genericCode);
    } catch (err: any) {
      this.logger.warn(
        `Failed to parse XML for provider detection: ${err.message}`,
      );
      return this.fallbackUnknown(null, null);
    }
  }

  public detectFromMetadata(
    msttcgp?: string | null,
    sellerTaxCode?: string | null,
    lookupCode?: string | null,
    lookupUrl?: string | null,
  ): InvoiceProviderLookupInfo {
    if (
      sellerTaxCode &&
      VINGROUP_TAX_CODES.some((mst) => sellerTaxCode.startsWith(mst))
    ) {
      return {
        providerCode: 'VINFAST',
        providerName: 'Vingroup / VinFast E-Invoice',
        msttcgp: msttcgp || null,
        lookupCode: lookupCode || null,
        lookupUrl:
          lookupUrl ||
          'https://e-invoice-tt78.vingroup.net/TraCuu/SearchBySalt',
      };
    }

    if (msttcgp && KNOWN_MSTTCGP[msttcgp]) {
      const known = KNOWN_MSTTCGP[msttcgp];
      return {
        providerCode: known.code,
        providerName: known.name,
        msttcgp,
        lookupCode: lookupCode || null,
        lookupUrl: lookupUrl || known.url,
      };
    }

    return this.fallbackUnknown(msttcgp, lookupCode, lookupUrl);
  }

  private fallbackUnknown(
    msttcgp: string | null = null,
    lookupCode: string | null = null,
    lookupUrl: string | null = null,
  ): InvoiceProviderLookupInfo {
    return {
      providerCode: 'OTHER',
      providerName: 'Nhà cung cấp khác',
      msttcgp,
      lookupCode,
      lookupUrl,
    };
  }

  private extractTag(doc: any, ...tags: string[]): string | null {
    for (const tag of tags) {
      const els = doc.getElementsByTagName
        ? doc.getElementsByTagName(tag)
        : null;
      if (els && els.length > 0) {
        const text = els[0].textContent?.trim();
        if (text) return text;
      }
    }
    return null;
  }

  private extractTTKhac(doc: any): Record<string, string> {
    const result: Record<string, string> = {};
    const ttkhacs = doc.getElementsByTagName
      ? doc.getElementsByTagName('TTKhac')
      : [];
    for (let i = 0; i < ttkhacs.length; i++) {
      const ttins = ttkhacs[i].getElementsByTagName('TTin');
      for (let j = 0; j < ttins.length; j++) {
        const truong =
          this.extractTag(ttins[j], 'TTruong', 'Ten')?.toLowerCase() || '';
        const dlieu =
          this.extractTag(ttins[j], 'DLieu', 'KDLieu', 'GiaTri') || '';
        if (truong && dlieu) result[truong] = dlieu;
      }
    }
    return result;
  }
}

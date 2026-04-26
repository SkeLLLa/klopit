/**
 * IBI Capital company-name → ticker map.
 *
 * Data ported from the upstream open-source project pbialon/pit-38
 * (https://github.com/pbialon/pit-38), file
 * `pit38/plugins/stock/ibi_capital/companies.json` \@ commit
 * 296427a15542d754ae6840bd0bb803c25d39b380. MIT License,
 * Copyright (c) 2025 Przemek Białoń. The MIT permission notice is
 * preserved below as required by the license.
 *
 * MIT License
 *
 * Copyright (c) 2025 Przemek Białoń
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
const IBI_COMPANY_TO_TICKER: Record<string, string> = {
  'allot': 'ALLT',
  'arbe robotics': 'ARBE',
  'arcturus therapeutics': 'ARCT',
  'audiocodes': 'AUDC',
  'b.o.s. better online solutions': 'BOSC',
  'biolinerx': 'BLRX',
  'biondvax pharmaceuticals': 'BVXV',
  'brainstorm cell therapeutics': 'BCLI',
  'brainsway': 'BWAY',
  'caesarstone': 'CSTE',
  'camtek': 'CAMT',
  'cellebrite': 'CLBT',
  'ceragon networks': 'CRNT',
  'ceva': 'CEVA',
  'check point software technologies': 'CHKP',
  'collplant biotechnologies': 'CLGN',
  'compugen': 'CGEN',
  'cyberark': 'CYBR',
  'dariohealth': 'DRIO',
  'elbit systems': 'ESLT',
  'eltek': 'ELTK',
  'enlight renewable energy': 'ENLT',
  'entera bio': 'ENTX',
  'evogene': 'EVGN',
  'fiverr': 'FVRR',
  'foresight autonomous holdings': 'FRSX',
  'formula systems': 'FORTY',
  'galmed pharmaceuticals': 'GLMD',
  'gilat satellite networks': 'GILT',
  'global-e online': 'GLBE',
  'hippo holdings': 'HIPO',
  'icl group': 'ICL',
  'inmode': 'INMD',
  'innoviz technologies': 'INVZ',
  'ituran location and control': 'ITRN',
  'jfrog': 'FROG',
  'kaltura': 'KLTR',
  'kamada': 'KMDA',
  'kornit digital': 'KRNT',
  'lemonade': 'LMND',
  'magic software enterprises': 'MGIC',
  'mediwound': 'MDWD',
  'mind cti': 'MNDO',
  'mobileye': 'MBLY',
  'monday.com': 'MNDY',
  'nano dimension': 'NNDM',
  'nano-x imaging': 'NNOX',
  'nayax': 'NYAX',
  'nice': 'NICE',
  'nova': 'NVMI',
  'oddity tech': 'ODD',
  'optibase': 'OBAS',
  'oramed pharmaceuticals': 'ORMP',
  'ormat technologies': 'ORA',
  'otonomo technologies': 'OTMO',
  'outbrain': 'OB',
  'pagaya technologies': 'PGY',
  'partner communications': 'PTNR',
  'payoneer': 'PAYO',
  'perion network': 'PERI',
  'playtika': 'PLTK',
  'polypid': 'PYPD',
  'radcom': 'RDCM',
  'radware': 'RDWR',
  'rani therapeutics': 'RANI',
  'redhill biopharma': 'RDHL',
  'ree automotive': 'REE',
  'rewalk robotics': 'LFWD',
  'riskified': 'RSKD',
  'sapiens international': 'SPNS',
  'satixfy communications': 'SATX',
  'scisparc': 'SPRC',
  'silicom': 'SILC',
  'sol-gel technologies': 'SLGL',
  'solaredge technologies': 'SEDG',
  'stratasys': 'SSYS',
  'supercom': 'SPCB',
  'taboola': 'TBLA',
  'taro pharmaceutical industries': 'TARO',
  'tat technologies': 'TATT',
  'teva pharmaceutical industries': 'TEVA',
  'tigo energy': 'TYGO',
  'tower semiconductor': 'TSEM',
  'urogen pharma': 'URGN',
  'valens semiconductor': 'VLN',
  'varonis systems': 'VRNS',
  'verint systems': 'VRNT',
  'wix.com': 'WIX',
  'xtl biopharmaceuticals': 'XTLB',
  'zim integrated shipping services': 'ZIM',
};

/**
 * Resolve a Company-field string from an IBI PDF to a ticker. Falls back
 * to the input uppercased when no mapping is known (preserves prior
 * behaviour for tickers that already appear as the Company value).
 */
export function resolveIbiTicker(companyName: string): string {
  const key = companyName.trim().toLowerCase();
  return IBI_COMPANY_TO_TICKER[key] ?? companyName.trim().toUpperCase();
}

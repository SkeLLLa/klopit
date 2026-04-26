import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { ibiDefinition, parseIbiText } from '../src/core/parsers/ibi/index.js';

/**
 * Synthetic text that mirrors the shape `extractPdfText` emits for the
 * IBI "Sale Of Stock Activity Statement" template. Each hand-authored
 * test uses a subset of this layout so failures localise to the field
 * under test.
 *
 * All personal data (name, IDs, amounts) is fictional; ticker is MNDY
 * (monday.com Ltd.) as a stand-in for ESPP-issuing employers.
 */
const SAMPLE_ORDER_TEXT = [
  'Sale Of Stock Activity Statement Order Number: 1234567',
  'Jane Doe ID / SS # Company: MNDY',
  'Grant Date: August 31, 2025 Grant No.: ESPP99999 Plan: MNDY ESPP',
  'Order Date: March 30, 2026 Execution Date: March 30, 2026 Price For Tax: USD 225.50',
  'Total Amount Due to Order 50 USD 280.4100 USD 14,020.50',
  'Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD 8.25',
].join('\n');

void describe('parseIbiText', () => {
  void it('emits a buy trade on Grant Date at Price For Tax', () => {
    const result = parseIbiText({ text: SAMPLE_ORDER_TEXT });

    const buys = result.trades.filter((t) => t.type === 'buy');
    assert.equal(buys.length, 1);

    const buy = buys[0];
    assert.equal(buy.symbol, 'MNDY');
    assert.equal(buy.currency, 'USD');
    assert.equal(buy.quantity, 50);
    assert.equal(buy.price, 225.5);
    assert.equal(buy.proceeds, 225.5 * 50);
    assert.equal(buy.commission, 0);
    assert.equal(buy.source, 'espp');
    assert.equal(buy.datetime.getFullYear(), 2025);
    assert.equal(buy.datetime.getMonth(), 7); // August
    assert.equal(buy.datetime.getDate(), 31);
  });

  void it('emits a sell trade on Execution Date at Sale Price', () => {
    const result = parseIbiText({ text: SAMPLE_ORDER_TEXT });

    const sells = result.trades.filter((t) => t.type === 'sell');
    assert.equal(sells.length, 1);

    const sell = sells[0];
    assert.equal(sell.symbol, 'MNDY');
    assert.equal(sell.currency, 'USD');
    assert.equal(sell.quantity, 50);
    assert.equal(sell.price, 280.41);
    assert.equal(sell.proceeds, 14020.5);
    assert.equal(sell.commission, 8.25);
    assert.equal(sell.source, 'espp');
    assert.equal(sell.datetime.getFullYear(), 2026);
    assert.equal(sell.datetime.getMonth(), 2); // March
    assert.equal(sell.datetime.getDate(), 30);
  });

  void it('sets broker id and country (IL — IBI Capital is Israeli)', () => {
    const result = parseIbiText({ text: SAMPLE_ORDER_TEXT });
    assert.equal(result.broker, 'ibi');
    assert.equal(result.brokerCountry, 'IL');
  });

  void it('infers year from Execution Date', () => {
    const result = parseIbiText({ text: SAMPLE_ORDER_TEXT });
    assert.equal(result.year, 2026);
  });

  void it('parses comma-thousands in Sale Price and amounts', () => {
    const text = [
      'Company: MNDY',
      'Grant Date: November 15, 2024 Grant No.: ESPP88888 Plan: MNDY ESPP',
      'Order Date: November 22, 2024 Execution Date: November 22, 2024 Price For Tax: USD 195.75',
      'Total Amount Due to Order 80 USD 315.7500 USD 25,260.00',
      'Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD 35.00',
    ].join('\n');

    const result = parseIbiText({ text });
    const sell = result.trades.find((t) => t.type === 'sell');
    assert.ok(sell);
    assert.equal(sell.quantity, 80);
    assert.equal(sell.price, 315.75);
    assert.equal(sell.proceeds, 25260);
    assert.equal(sell.commission, 35);
  });

  void it('returns empty trades when required fields are missing', () => {
    const result = parseIbiText({ text: 'Some unrelated header text' });
    assert.equal(result.trades.length, 0);
    assert.ok(
      result.warnings.length > 0,
      'expected at least one warning when parsing fails',
    );
  });

  void it('tags both trades of an order with a matching lotId (= Order Number)', () => {
    const result = parseIbiText({ text: SAMPLE_ORDER_TEXT });
    assert.equal(result.trades.length, 2);
    const [buy, sell] = result.trades;
    assert.equal(buy.lotId, '1234567');
    assert.equal(sell.lotId, '1234567');
  });

  void it('flags totalFees as missing when Total Fees regex fails to match', () => {
    // Otherwise-valid statement with the Total Fees line removed — isolates
    // the missing-fees branch from the all-fields-missing path covered above.
    const pdfWithoutFees = SAMPLE_ORDER_TEXT.split('\n')
      .filter((line) => !line.startsWith('Total Fees'))
      .join('\n');

    const result = parseIbiText({ text: pdfWithoutFees });

    const feeWarning = result.warnings.find((w) =>
      w.message.includes('Total Fees'),
    );
    assert.ok(feeWarning, 'expected a warning flagging missing Total Fees');
    assert.equal(
      feeWarning.message,
      'Missing required fields: Total Fees',
      'warning should mention only Total Fees, not other fields',
    );
    assert.equal(result.trades.length, 0);
  });

  void it('captures multi-word Company names and resolves to ticker', () => {
    const text = [
      'Sale Of Stock Activity Statement Order Number: 1234567',
      'Jane Doe ID / SS # Company: Check Point Software Technologies',
      'Grant Date: August 31, 2025 Grant No.: ESPP99999 Plan: CHKP ESPP',
      'Order Date: March 30, 2026 Execution Date: March 30, 2026 Price For Tax: USD 100.00',
      'Total Amount Due to Order 10 USD 150.00 USD 1,500.00',
      'Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD 5.00',
    ].join('\n');
    const result = parseIbiText({ text });
    assert.equal(result.warnings.length, 0);
    assert.equal(result.trades[0].symbol, 'CHKP');
  });

  void it('falls back to uppercased Company when no mapping exists', () => {
    const text = SAMPLE_ORDER_TEXT.replace(
      'Company: MNDY',
      'Company: NewcoLtd',
    );
    const result = parseIbiText({ text });
    assert.equal(result.warnings.length, 0);
    assert.equal(result.trades[0].symbol, 'NEWCOLTD');
  });

  void it('emits distinct lotIds for distinct orders (FIFO partition key)', () => {
    const textA = [
      'Sale Of Stock Activity Statement Order Number: 1000001',
      'Company: TSLA',
      'Grant Date: August 31, 2025 Grant No.: ESPP1 Plan: TSLA ESPP',
      'Order Date: March 30, 2026 Execution Date: March 30, 2026 Price For Tax: USD 119.92',
      'Total Amount Due to Order 71 USD 87.2100 USD 6,191.91',
      'Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD 10.19',
    ].join('\n');
    const textB = [
      'Sale Of Stock Activity Statement Order Number: 2000002',
      'Company: TSLA',
      'Grant Date: February 28, 2026 Grant No.: ESPP2 Plan: TSLA ESPP',
      'Order Date: March 30, 2026 Execution Date: March 30, 2026 Price For Tax: USD 59.89',
      'Total Amount Due to Order 146 USD 87.2100 USD 12,732.66',
      'Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD 17.11',
    ].join('\n');

    const a = parseIbiText({ text: textA });
    const b = parseIbiText({ text: textB });

    const lotIdsA = new Set(a.trades.map((t) => t.lotId));
    const lotIdsB = new Set(b.trades.map((t) => t.lotId));
    assert.deepEqual([...lotIdsA], ['1000001']);
    assert.deepEqual([...lotIdsB], ['2000002']);
  });
});

/**
 * Anonymized IBI-format PDF fixture, generated at test-time with
 * pdf-lib. Positions text tokens to mimic the real statement layout so
 * unpdf's positional extraction + `reconstructText` row-grouping can be
 * exercised end-to-end without committing a binary or relying on a
 * gitignored private statement.
 */
async function generateIbiPdf(data: {
  orderNumber: string;
  company: string;
  grantDate: string;
  grantNo: string;
  plan: string;
  orderDate: string;
  executionDate: string;
  priceForTax: string;
  shares: string;
  salePrice: string;
  totalAmount: string;
  totalFees: string;
}): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);

  const rows: { y: number; tokens: readonly { x: number; text: string }[] }[] =
    [
      {
        y: 760,
        tokens: [
          { x: 40, text: 'Sale Of Stock Activity Statement' },
          { x: 320, text: `Order Number: ${data.orderNumber}` },
        ],
      },
      {
        y: 720,
        tokens: [
          { x: 40, text: 'Jane Doe' },
          { x: 240, text: 'ID / SS #' },
          { x: 400, text: `Company: ${data.company}` },
        ],
      },
      {
        y: 680,
        tokens: [
          { x: 40, text: `Grant Date: ${data.grantDate}` },
          { x: 240, text: `Grant No.: ${data.grantNo}` },
          { x: 420, text: `Plan: ${data.plan}` },
        ],
      },
      {
        y: 660,
        tokens: [
          { x: 40, text: `Order Date: ${data.orderDate}` },
          { x: 240, text: `Execution Date: ${data.executionDate}` },
          { x: 420, text: `Price For Tax: USD ${data.priceForTax}` },
        ],
      },
      {
        y: 580,
        tokens: [
          {
            x: 40,
            text: `Total Amount Due to Order ${data.shares} USD ${data.salePrice} USD ${data.totalAmount}`,
          },
        ],
      },
      {
        y: 500,
        tokens: [
          {
            x: 40,
            text: `Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD ${data.totalFees}`,
          },
        ],
      },
    ];

  for (const row of rows) {
    for (const token of row.tokens) {
      page.drawText(token.text, { x: token.x, y: row.y, size: 10, font });
    }
  }

  const bytes = await pdf.save();
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

void describe('ibiDefinition — end-to-end PDF parse', () => {
  async function parseGenerated(
    data: Parameters<typeof generateIbiPdf>[0],
  ): Promise<ReturnType<typeof parseIbiText>> {
    const buffer = await generateIbiPdf(data);
    return ibiDefinition.parse({ buffer });
  }

  void it('parses a cross-year ESPP sale (granted 2024, sold 2025)', async () => {
    const result = await parseGenerated({
      orderNumber: '1234567',
      company: 'MNDY',
      grantDate: 'August 31, 2024',
      grantNo: 'ESPP99999',
      plan: 'MNDY ESPP',
      orderDate: 'March 30, 2025',
      executionDate: 'March 30, 2025',
      priceForTax: '225.50',
      shares: '50',
      salePrice: '280.4100',
      totalAmount: '14,020.50',
      totalFees: '8.25',
    });

    assert.equal(result.broker, 'ibi');
    assert.equal(result.brokerCountry, 'IL');
    assert.equal(result.year, 2025);
    assert.equal(result.trades.length, 2);

    const buy = result.trades.find((trade) => trade.type === 'buy');
    const sell = result.trades.find((trade) => trade.type === 'sell');
    assert.ok(buy);
    assert.ok(sell);
    assert.equal(buy.symbol, 'MNDY');
    assert.equal(buy.quantity, 50);
    assert.equal(buy.price, 225.5);
    assert.equal(buy.commission, 0);
    assert.equal(buy.source, 'espp');
    assert.equal(buy.datetime.getFullYear(), 2024);
    assert.equal(buy.datetime.getMonth(), 7);
    assert.equal(buy.datetime.getDate(), 31);

    assert.equal(sell.quantity, 50);
    assert.equal(sell.price, 280.41);
    assert.equal(sell.proceeds, 14020.5);
    assert.equal(sell.commission, 8.25);
    assert.equal(sell.source, 'espp');
    assert.equal(sell.datetime.getFullYear(), 2025);
    assert.equal(sell.datetime.getMonth(), 2);
    assert.equal(sell.datetime.getDate(), 30);
  });

  void it('parses a same-year ESPP sale with comma-thousands (granted & sold 2025)', async () => {
    const result = await parseGenerated({
      orderNumber: '7654321',
      company: 'MNDY',
      grantDate: 'March 15, 2025',
      grantNo: 'ESPP88888',
      plan: 'MNDY ESPP',
      orderDate: 'November 22, 2025',
      executionDate: 'November 22, 2025',
      priceForTax: '195.75',
      shares: '80',
      salePrice: '315.7500',
      totalAmount: '25,260.00',
      totalFees: '35.00',
    });

    assert.equal(result.year, 2025);
    assert.equal(result.trades.length, 2);

    const buy = result.trades.find((trade) => trade.type === 'buy');
    const sell = result.trades.find((trade) => trade.type === 'sell');
    assert.ok(buy);
    assert.ok(sell);
    assert.equal(buy.price, 195.75);
    assert.equal(buy.quantity, 80);
    assert.equal(buy.datetime.getFullYear(), 2025);
    assert.equal(buy.datetime.getMonth(), 2);
    assert.equal(buy.datetime.getDate(), 15);

    assert.equal(sell.quantity, 80);
    assert.equal(sell.price, 315.75);
    assert.equal(sell.proceeds, 25260);
    assert.equal(sell.commission, 35);
    assert.equal(sell.datetime.getFullYear(), 2025);
    assert.equal(sell.datetime.getMonth(), 10);
    assert.equal(sell.datetime.getDate(), 22);
  });
});

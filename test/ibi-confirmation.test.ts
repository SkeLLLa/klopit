import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { ibiDefinition, parseIbiText } from '../src/core/parsers/ibi/index.js';

/**
 * Synthetic flat text that mirrors what `extractPdfText` emits for the IBI
 * "Confirmation of Sale" template after positional reconstruction.
 *
 * The two-column layout means some left-column and right-column tokens land
 * on the same reconstructed line (same y-band). All personal data is
 * fictional; WIX (Wix.com Ltd.) is used as the representative ESPP issuer.
 */
const SAMPLE_CONFIRMATION_TEXT = [
  'IBI CAPITAL Confirmation of Sale',
  'Wix.com Ltd. Employee Stock Purchase Plan',
  'To: Jane Doe Exercise Period:',
  'Employee Number: 123456 Entry Date: March 01, 2025',
  'Total Contributions: Exercise Date: August 31, 2025',
  'Previous Carry forward: 368.10 PLN',
  'Current Contribution: 9,750.00 $',
  'Total Contribution: 9,850.85 $',
  'Calculation of Shares Purchased:',
  'Fair Market Value on Entry Date: 200.69 $',
  'Fair Market Value on Exercise Date: 141.08 $',
  'Exercise Period Price (85% of lower): 119.92 $',
  'Exchange Rate USD-PLN on Exercise Date: 3.65 $',
  'Total Price: 9,833.28 $',
  'Shares Purchased: 82',
  'Carry Forward: 64.08 PLN',
  'Quick Sale-Activity Details:',
  'Shares Sold: 82 Sale Price* $140.4901 Sale Date: September 02, 2025',
  'Total Consideration: 11,520.19 $',
  'Broker Fee: 2.46 $',
  'IBI Fee: 11.52 $',
  'Total Fees: 13.98 $',
  'Actual Exchange Rate: 0.00 USD',
  'Gain For Tax: 0.00 USD',
  'Your Sale Proceeds **: 11,506.2080 USD Your Net Gain From This Plan : 1,672.93 USD',
].join('\n');

void describe('parseIbiText — Confirmation of Sale dispatcher', () => {
  void it('routes "Confirmation of Sale" to the confirmation parser', () => {
    const result = parseIbiText({ text: SAMPLE_CONFIRMATION_TEXT });
    assert.equal(result.trades.length, 2);
    for (const t of result.trades) assert.equal(t.source, 'espp');
  });
});

void describe('parseIbiText — Confirmation of Sale happy path', () => {
  void it('emits a buy trade on Exercise Date at Exercise Period Price', () => {
    const result = parseIbiText({ text: SAMPLE_CONFIRMATION_TEXT });

    const buys = result.trades.filter((t) => t.type === 'buy');
    assert.equal(buys.length, 1);

    const buy = buys[0];
    assert.equal(buy.symbol, 'WIX');
    assert.equal(buy.currency, 'USD');
    assert.equal(buy.quantity, 82);
    assert.equal(buy.price, 119.92);
    assert.equal(buy.proceeds, 119.92 * 82);
    assert.equal(buy.commission, 0);
    assert.equal(buy.source, 'espp');
    assert.equal(buy.datetime.getFullYear(), 2025);
    assert.equal(buy.datetime.getMonth(), 7); // August (0-indexed)
    assert.equal(buy.datetime.getDate(), 31);
  });

  void it('emits a sell trade on Sale Date at sale price with fees', () => {
    const result = parseIbiText({ text: SAMPLE_CONFIRMATION_TEXT });

    const sells = result.trades.filter((t) => t.type === 'sell');
    assert.equal(sells.length, 1);

    const sell = sells[0];
    assert.equal(sell.symbol, 'WIX');
    assert.equal(sell.currency, 'USD');
    assert.equal(sell.quantity, 82);
    assert.equal(sell.price, 140.4901);
    assert.equal(sell.proceeds, 11520.19);
    assert.equal(sell.commission, 13.98);
    assert.equal(sell.source, 'espp');
    assert.equal(sell.datetime.getFullYear(), 2025);
    assert.equal(sell.datetime.getMonth(), 8); // September (0-indexed)
    assert.equal(sell.datetime.getDate(), 2);
  });

  void it('sets broker id, country, and infers year from Sale Date', () => {
    const result = parseIbiText({ text: SAMPLE_CONFIRMATION_TEXT });
    assert.equal(result.broker, 'ibi');
    assert.equal(result.brokerCountry, 'IL');
    assert.equal(result.year, 2025);
  });

  void it('tags both trades with a shared lotId derived from the exercise period', () => {
    const result = parseIbiText({ text: SAMPLE_CONFIRMATION_TEXT });
    assert.equal(result.trades.length, 2);
    const [buy, sell] = result.trades;
    const { lotId } = buy;
    assert.ok(lotId, 'buy lotId should be set');
    assert.equal(lotId, sell.lotId, 'both trades must share the same lotId');
    assert.match(
      lotId,
      /^\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}$/,
      'lotId should encode entry and exercise dates',
    );
  });

  void it('uses Entry Date and Exercise Date boundaries as distinct lotIds per period', () => {
    const periodA = SAMPLE_CONFIRMATION_TEXT; // entry March 2025 / exercise Aug 2025
    const periodB = [
      'IBI CAPITAL Confirmation of Sale',
      'Wix.com Ltd. Employee Stock Purchase Plan',
      'Entry Date: September 01, 2025',
      'Exercise Date: February 28, 2026',
      'Exercise Period Price (85% of lower): 98.50 $',
      'Shares Purchased: 60',
      'Shares Sold: 60 Sale Price* $115.0000 Sale Date: March 02, 2026',
      'Total Consideration: 6,900.00 $',
      'Total Fees: 10.50 $',
    ].join('\n');

    const a = parseIbiText({ text: periodA });
    const b = parseIbiText({ text: periodB });

    assert.notEqual(
      a.trades[0].lotId,
      b.trades[0].lotId,
      'different exercise periods must produce different lotIds',
    );
  });

  void it('handles comma-thousands in amounts', () => {
    const text = [
      'Confirmation of Sale',
      'Wix.com Ltd. Employee Stock Purchase Plan',
      'Entry Date: March 01, 2024',
      'Exercise Date: August 31, 2024',
      'Exercise Period Price (85% of lower): 1,050.00 $',
      'Shares Purchased: 10',
      'Shares Sold: 10 Sale Price* $1,250.0000 Sale Date: September 02, 2024',
      'Total Consideration: 12,500.00 $',
      'Total Fees: 18.75 $',
    ].join('\n');

    const result = parseIbiText({ text });
    const buy = result.trades.find((t) => t.type === 'buy');
    const sell = result.trades.find((t) => t.type === 'sell');
    assert.ok(buy);
    assert.ok(sell);
    assert.equal(buy.price, 1050);
    assert.equal(sell.price, 1250);
    assert.equal(sell.proceeds, 12500);
  });

  void it('returns empty trades with a warning when required fields are missing', () => {
    const result = parseIbiText({
      text: 'Confirmation of Sale\nSome unrelated text',
    });
    assert.equal(result.trades.length, 0);
    assert.ok(result.warnings.length > 0, 'expected at least one warning');
    assert.match(result.warnings[0].message, /Missing required fields/);
  });

  void it('warns about only the specific missing field', () => {
    const withoutFees = SAMPLE_CONFIRMATION_TEXT.split('\n')
      .filter((line) => !line.startsWith('Total Fees:'))
      .join('\n');

    const result = parseIbiText({ text: withoutFees });
    assert.equal(result.trades.length, 0);
    const w = result.warnings.find((x) => x.message.includes('Total Fees'));
    assert.ok(w, 'expected a warning about Total Fees');
    assert.equal(w.message, 'Missing required fields: Total Fees');
  });
});

void describe('parseIbiText — ESPP regression after Confirmation dispatch', () => {
  void it('still routes "Sale Of Stock Activity Statement" to the ESPP parser', () => {
    const esppText = [
      'Sale Of Stock Activity Statement Order Number: 1234567',
      'Jane Doe ID / SS # Company: MNDY',
      'Grant Date: August 31, 2025 Grant No.: ESPP99999 Plan: MNDY ESPP',
      'Execution Date: March 30, 2026 Price For Tax: USD 225.50',
      'Total Amount Due to Order 50 USD 280.4100 USD 14,020.50',
      'Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD 8.25',
    ].join('\n');
    const result = parseIbiText({ text: esppText });
    assert.equal(result.trades.length, 2);
    for (const t of result.trades) assert.equal(t.source, 'espp');
  });
});

/**
 * Build a synthetic single-page PDF whose token positions mimic the IBI
 * "Confirmation of Sale" two-column layout. Positions are chosen so that
 * `reconstructText` groups tokens into the correct rows.
 */
async function generateConfirmationPdf(data: {
  entryDate: string;
  exerciseDate: string;
  exercisePrice: string;
  shares: string;
  salePrice: string;
  saleDate: string;
  totalConsideration: string;
  totalFees: string;
  company: string; // e.g. "Wix.com Ltd."
}): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);

  const rows: { y: number; tokens: readonly { x: number; text: string }[] }[] =
    [
      { y: 760, tokens: [{ x: 200, text: 'Confirmation of Sale' }] },
      {
        y: 740,
        tokens: [
          {
            x: 140,
            text: `${data.company} Employee Stock Purchase Plan`,
          },
        ],
      },
      // Two-column: left = employee info, right = Exercise Period dates
      {
        y: 700,
        tokens: [
          { x: 40, text: 'To: Jane Doe' },
          { x: 380, text: 'Exercise Period:' },
        ],
      },
      {
        y: 680,
        tokens: [
          { x: 40, text: 'Employee Number: 123456' },
          { x: 380, text: `Entry Date: ${data.entryDate}` },
        ],
      },
      {
        y: 660,
        tokens: [
          { x: 40, text: 'Total Contributions:' },
          { x: 380, text: `Exercise Date: ${data.exerciseDate}` },
        ],
      },
      // Calculation section
      {
        y: 580,
        tokens: [
          {
            x: 40,
            text: `Exercise Period Price (85% of lower): ${data.exercisePrice} $`,
          },
        ],
      },
      {
        y: 560,
        tokens: [{ x: 40, text: `Shares Purchased: ${data.shares}` }],
      },
      // Quick Sale section — Sale Price and Sale Date share one visual row
      {
        y: 480,
        tokens: [
          { x: 40, text: `Shares Sold: ${data.shares}` },
          { x: 180, text: `Sale Price* $${data.salePrice}` },
          { x: 380, text: `Sale Date: ${data.saleDate}` },
        ],
      },
      {
        y: 460,
        tokens: [
          { x: 40, text: `Total Consideration: ${data.totalConsideration} $` },
        ],
      },
      {
        y: 420,
        tokens: [{ x: 40, text: `Total Fees: ${data.totalFees} $` }],
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

void describe('ibiDefinition — Confirmation of Sale end-to-end PDF parse', () => {
  async function parseGenerated(
    data: Parameters<typeof generateConfirmationPdf>[0],
  ) {
    const buffer = await generateConfirmationPdf(data);
    return ibiDefinition.parse({ buffer });
  }

  void it('parses a cross-period ESPP confirmation (exercise Aug 2025, sold Sep 2025)', async () => {
    const result = await parseGenerated({
      company: 'Wix.com Ltd.',
      entryDate: 'March 01, 2025',
      exerciseDate: 'August 31, 2025',
      exercisePrice: '119.92',
      shares: '82',
      salePrice: '140.4901',
      saleDate: 'September 02, 2025',
      totalConsideration: '11,520.19',
      totalFees: '13.98',
    });

    assert.equal(result.broker, 'ibi');
    assert.equal(result.brokerCountry, 'IL');
    assert.equal(result.year, 2025);
    assert.equal(result.trades.length, 2);

    const buy = result.trades.find((t) => t.type === 'buy');
    const sell = result.trades.find((t) => t.type === 'sell');
    assert.ok(buy);
    assert.ok(sell);

    assert.equal(buy.symbol, 'WIX');
    assert.equal(buy.quantity, 82);
    assert.equal(buy.price, 119.92);
    assert.equal(buy.commission, 0);
    assert.equal(buy.source, 'espp');
    assert.equal(buy.datetime.getFullYear(), 2025);
    assert.equal(buy.datetime.getMonth(), 7); // August
    assert.equal(buy.datetime.getDate(), 31);

    assert.equal(sell.symbol, 'WIX');
    assert.equal(sell.quantity, 82);
    assert.equal(sell.price, 140.4901);
    assert.equal(sell.proceeds, 11520.19);
    assert.equal(sell.commission, 13.98);
    assert.equal(sell.source, 'espp');
    assert.equal(sell.datetime.getFullYear(), 2025);
    assert.equal(sell.datetime.getMonth(), 8); // September
    assert.equal(sell.datetime.getDate(), 2);

    assert.equal(buy.lotId, sell.lotId);
  });

  void it('parses a second exercise period and produces a different lotId', async () => {
    const r1 = await parseGenerated({
      company: 'Wix.com Ltd.',
      entryDate: 'March 01, 2025',
      exerciseDate: 'August 31, 2025',
      exercisePrice: '119.92',
      shares: '82',
      salePrice: '140.49',
      saleDate: 'September 02, 2025',
      totalConsideration: '11,520.18',
      totalFees: '13.98',
    });
    const r2 = await parseGenerated({
      company: 'Wix.com Ltd.',
      entryDate: 'September 01, 2025',
      exerciseDate: 'February 28, 2026',
      exercisePrice: '105.00',
      shares: '60',
      salePrice: '130.00',
      saleDate: 'March 02, 2026',
      totalConsideration: '7,800.00',
      totalFees: '11.00',
    });

    assert.notEqual(r1.trades[0].lotId, r2.trades[0].lotId);
    assert.equal(r2.year, 2026);
  });
});

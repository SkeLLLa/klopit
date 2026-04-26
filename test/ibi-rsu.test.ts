import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseIbiText } from '../src/core/parsers/ibi/index.js';

const FIXTURE_PATH = fileURLToPath(
  new URL('./fixtures/ibi-rsu-sample.txt', import.meta.url),
);
const RSU_TEXT = readFileSync(FIXTURE_PATH, 'utf8');

void describe('parseIbiText — RSU dispatcher', () => {
  void it('routes "Sale of Trustee Shares Activity Statement" to RSU parser', () => {
    const result = parseIbiText({ text: RSU_TEXT });
    assert.equal(result.trades.length, 2);
    for (const t of result.trades) assert.equal(t.source, 'rsu');
  });
});

void describe('parseIbiText — RSU happy path', () => {
  void it('emits buy trade at price 0 on Grant Date', () => {
    const result = parseIbiText({ text: RSU_TEXT });
    const buys = result.trades.filter((t) => t.type === 'buy');
    assert.equal(buys.length, 1);
    const buy = buys[0];
    assert.equal(buy.symbol, 'ACME');
    assert.equal(buy.currency, 'USD');
    assert.equal(buy.quantity, 25);
    assert.equal(buy.price, 0);
    assert.equal(buy.proceeds, 0);
    assert.equal(buy.commission, 0);
    assert.equal(buy.source, 'rsu');
    assert.equal(buy.lotId, '9999001');
    assert.equal(buy.datetime.getFullYear(), 2022);
    assert.equal(buy.datetime.getMonth(), 0);
    assert.equal(buy.datetime.getDate(), 15);
  });

  void it('emits sell trade on Execution Date with sale price + fees', () => {
    const result = parseIbiText({ text: RSU_TEXT });
    const sells = result.trades.filter((t) => t.type === 'sell');
    assert.equal(sells.length, 1);
    const sell = sells[0];
    assert.equal(sell.symbol, 'ACME');
    assert.equal(sell.quantity, 25);
    assert.equal(sell.price, 125);
    assert.equal(sell.proceeds, 3125);
    assert.equal(sell.commission, 4.17);
    assert.equal(sell.source, 'rsu');
    assert.equal(sell.lotId, '9999001');
    assert.equal(sell.datetime.getFullYear(), 2024);
    assert.equal(sell.datetime.getMonth(), 6);
    assert.equal(sell.datetime.getDate(), 20);
  });

  void it('infers year from Execution Date and sets broker metadata', () => {
    const result = parseIbiText({ text: RSU_TEXT });
    assert.equal(result.year, 2024);
    assert.equal(result.broker, 'ibi');
    assert.equal(result.brokerCountry, 'IL');
  });

  void it('flags missing required fields fail-loud', () => {
    const stripped = RSU_TEXT.replace(
      /Execution Date: July 20, 2024 Ex\. rate at Sell Date: 0\.000/,
      'Ex. rate at Sell Date: 0.000',
    );
    const result = parseIbiText({ text: stripped });
    assert.equal(result.trades.length, 0);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0].message, /Execution Date/);
  });
});

void describe('parseIbiText — RSU multi-word Company', () => {
  void it('captures multi-word Company names and resolves to ticker', () => {
    const text = [
      'Sale of Trustee Shares Activity Statement Order Number: 9999002',
      'Jane Doe ID / SS # Company: Check Point Software Technologies',
      'Grant Date: January 15, 2022 Grant No.: RSU99999 Plan: CHKP RSU',
      'Execution Date: July 20, 2024 Ex. rate at Sell Date: 0.000',
      'Total Amount Due to Order 25 USD 125.00 USD 3,125.00',
      'Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD 4.17',
    ].join('\n');
    const result = parseIbiText({ text });
    assert.equal(result.warnings.length, 0);
    assert.equal(result.trades[0].symbol, 'CHKP');
  });
});

void describe('parseIbiText — RSU unknown-company fallback', () => {
  void it('falls back to uppercased Company when no mapping exists', () => {
    const text = [
      'Sale of Trustee Shares Activity Statement Order Number: 9999003',
      'Jane Doe ID / SS # Company: NewcoLtd',
      'Grant Date: January 15, 2022 Grant No.: RSU99999 Plan: NewcoLtd RSU',
      'Execution Date: July 20, 2024 Ex. rate at Sell Date: 0.000',
      'Total Amount Due to Order 25 USD 125.00 USD 3,125.00',
      'Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD 4.17',
    ].join('\n');
    const result = parseIbiText({ text });
    assert.equal(result.warnings.length, 0);
    assert.equal(result.trades[0].symbol, 'NEWCOLTD');
  });
});

void describe('parseIbiText — ESPP still works (regression)', () => {
  void it('routes "Sale Of Stock Activity Statement" to ESPP parser', () => {
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

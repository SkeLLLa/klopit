import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getParserDefinition,
  supportedBrokers,
} from '../src/core/parsers/registry.js';
import { BrokerId } from '../src/core/types.js';

void describe('registry', () => {
  void describe('getParserDefinition', () => {
    void it('returns definition for Interactive Brokers', () => {
      const def = getParserDefinition({
        brokerId: BrokerId.InteractiveBrokers,
      });
      assert.equal(def.brokerId, 'interactive-brokers');
      assert.equal(def.brokerName, 'Interactive Brokers');
    });

    void it('creates a working parser from definition', () => {
      const def = getParserDefinition({
        brokerId: BrokerId.InteractiveBrokers,
      });
      const parser = def.createParser();
      assert.ok(typeof parser.feed === 'function');
      assert.ok(typeof parser.finish === 'function');
    });

    void it('throws for unknown broker ID', () => {
      assert.throws(
        () => getParserDefinition({ brokerId: 'unknown-broker' as BrokerId }),
        { message: /Unsupported broker/ },
      );
    });
  });

  void describe('supportedBrokers', () => {
    void it('returns list with Interactive Brokers', () => {
      const brokers = supportedBrokers();
      assert.ok(brokers.length >= 1);
      assert.ok(brokers.some((b) => b.name === 'Interactive Brokers'));
    });
  });
});

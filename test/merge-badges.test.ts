import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeBadges } from '../src/lib/utils/merge-badges.js';

void describe('mergeBadges', () => {
  void it('merges same-text badges into one that lists every description', () => {
    const merged = mergeBadges({
      badges: [
        { badge: 'Reversed', title: 'T', description: 'on 2024-03-20' },
        { badge: 'By symbol', title: 'S', description: 'x' },
        { badge: 'Reversed', title: 'T', description: 'on 2024-03-22' },
      ],
    });
    assert.deepEqual(
      merged.map((b) => b.badge),
      ['Reversed', 'By symbol'],
    );
    assert.equal(merged[0].description, 'on 2024-03-20\non 2024-03-22');
  });

  void it('does not mutate its input', () => {
    const badges = [
      { badge: 'A', title: 'T', description: '1' },
      { badge: 'A', title: 'T', description: '2' },
    ];
    mergeBadges({ badges });
    assert.equal(badges[0].description, '1');
  });
});

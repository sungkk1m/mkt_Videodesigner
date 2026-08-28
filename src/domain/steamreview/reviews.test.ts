// steam-review Design Ref: §12.1 — the embedded wording must be complete for
// all four locales (Plan Q6: there is no editing UI to fix a hole later).
import {describe, expect, it} from 'vitest';

import {LOCALES, STEAM_REVIEW_KR_NOTICE} from '../editor/constants';
import {
  STEAM_REVIEWS,
  STEAM_REVIEW_DEFAULT_COPY,
  STEAM_REVIEW_RECOMMENDED_LABELS,
  steamReviewHoursLabel,
} from './reviews';

describe('STEAM_REVIEWS', () => {
  it('embeds four reviews with text in every locale', () => {
    expect(STEAM_REVIEWS).toHaveLength(4);

    for (const review of STEAM_REVIEWS) {
      expect(review.hours).toBeGreaterThan(0);

      for (const locale of LOCALES) {
        expect(review.text[locale].length).toBeGreaterThan(0);
      }
    }
  });

  it('gives each review its own avatar', () => {
    const keys = STEAM_REVIEWS.map((review) => review.avatarKey);

    expect(new Set(keys).size).toBe(4);
  });
});

describe('labels', () => {
  it('words the recommendation label per locale', () => {
    expect(STEAM_REVIEW_RECOMMENDED_LABELS).toEqual({
      ko: '추천',
      en: 'Recommended',
      ja: 'おすすめ',
      'zh-TW': '推薦',
    });
  });

  it('formats hours-on-record per locale', () => {
    expect(steamReviewHoursLabel('ko', 56.9)).toBe('기록상 56.9시간');
    expect(steamReviewHoursLabel('en', 56.9)).toBe('56.9 hrs on record');
    expect(steamReviewHoursLabel('ja', 4.8)).toBe('プレイタイム4.8時間');
    expect(steamReviewHoursLabel('zh-TW', 203.4)).toBe('總時數203.4小時');
  });
});

describe('STEAM_REVIEW_DEFAULT_COPY', () => {
  it('fills title, description, and four tags for every locale', () => {
    for (const locale of LOCALES) {
      const block = STEAM_REVIEW_DEFAULT_COPY[locale];

      expect(block.title.length).toBeGreaterThan(0);
      expect(block.description.length).toBeGreaterThan(0);
      expect(block.tags).toHaveLength(4);

      for (const tag of block.tags) {
        expect(tag.length).toBeGreaterThan(0);
      }
    }
  });

  // D-6 — the default wording itself must satisfy the schema's pinned tag.
  it('pins the Korean fourth tag to the loot-box notice', () => {
    expect(STEAM_REVIEW_DEFAULT_COPY.ko.tags[3]).toBe(STEAM_REVIEW_KR_NOTICE);
  });
});

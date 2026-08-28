// steam-review Design Ref: §6 — the fixed store-page wording. Reviews, labels,
// and the default copy are embedded constants (Plan Q6): they are not project
// data, so rewording them later never migrates a stored document.
import {STEAM_REVIEW_KR_NOTICE} from '../editor/constants';
import type {Locale, SteamReviewCopy} from '../editor/types';

/**
 * Which avatar a review shows. The pixels live with the composition
 * (`compositions/steamreview/assets`); the domain knows only the key, so it
 * stays free of file URLs.
 */
export type SteamReviewAvatarKey =
  | 'avatar-1'
  | 'avatar-2'
  | 'avatar-3'
  | 'avatar-4';

export interface SteamReviewEntry {
  avatarKey: SteamReviewAvatarKey;
  /** Shared across locales — the reference shows the same numbers everywhere. */
  hours: number;
  text: Record<Locale, string>;
}

/** Design §6.2 — four reviews, verbatim from the reference. */
export const STEAM_REVIEWS: readonly SteamReviewEntry[] = [
  {
    avatarKey: 'avatar-1',
    hours: 56.9,
    text: {
      ko: '취향저격! 타워, 아이템 조합해가면서\n스테이지 공략하다 보니 하루 3시간 삭제돼요..!',
      en: "What I've been looking for!\nOnce you get the hang of the different towers\nand items you'll be playing for hours straight",
      // Read off the JP 16:9 video frame (module-5 ✱Do) — the mockup clipped
      // the closing lines.
      ja: '超絶おすすめ！\nタワー＆アイテムを合成してステージ攻略してたら\nあっという間に夜の9時に…！',
      // Read off the CT 16:9 video frame (module-5 ✱Do) — 「完全我的菜!」,
      // not 「完全把我的菜!」.
      'zh-TW': '完全我的菜!用塔和角色的組合來攻下關卡,\n一天的3小時就這樣不見了..!',
    },
  },
  {
    avatarKey: 'avatar-2',
    hours: 4.8,
    text: {
      ko: '도파민!! 재밌어요!!!',
      en: 'Pure dopamine!! 10/10!!',
      ja: '脳汁ドーパミン！最強ゲー！！',
      'zh-TW': '發瘋!! 也太好玩!!',
    },
  },
  {
    avatarKey: 'avatar-3',
    hours: 6.4,
    text: {
      ko: '얘를 이길 디펜스 게임이 없다',
      en: 'No other game comes even close',
      ja: 'ディフェンスゲーム好きでこれ知らんとか草',
      'zh-TW': '沒有比這個更頂的遊戲了',
    },
  },
  {
    avatarKey: 'avatar-4',
    hours: 203.4,
    text: {
      ko: '결국 돌고돌아 언닥임',
      en: 'The game that keeps you coming back for more',
      ja: '何だかんだでこれが1番だわ',
      'zh-TW': '玩來玩去還是這個最頂',
    },
  },
];

/** Design §6.1 — the recommendation label per locale. */
export const STEAM_REVIEW_RECOMMENDED_LABELS: Record<Locale, string> = {
  ko: '추천',
  en: 'Recommended',
  ja: 'おすすめ',
  'zh-TW': '推薦',
};

/** Design §6.1 — "hours on record", worded per locale. */
export const steamReviewHoursLabel = (locale: Locale, hours: number): string => {
  switch (locale) {
    case 'ko':
      return `기록상 ${hours}시간`;
    case 'ja':
      return `プレイタイム${hours}時間`;
    case 'zh-TW':
      return `總時數${hours}小時`;
    default:
      return `${hours} hrs on record`;
  }
};

/**
 * Design §6.3 / §3.4 — the UnderDark wording a fresh steam-review project
 * starts with, extracted from the reference mockups. Starting filled means the
 * first render is directly comparable to the reference (Plan §2.5).
 */
export const STEAM_REVIEW_DEFAULT_COPY: Record<Locale, SteamReviewCopy> = {
  ko: {
    title: '언더다크 : 디펜스',
    // KR renders three lines with no paragraph gap (kr-wide frame, module-5) —
    // unlike the other locales, whose closing runs as its own paragraph.
    description:
      '디펜스란, 최후의 최후까지 버티는 자가 이기는 거야.\n그 어떤 적이 오더라도 포기하지 마.\n최후의 캠프를 방어하라! 전략 인디게임 <언더다크:디펜스>',
    tags: [
      '전략 타워 디펜스',
      '압도적 긍정적 게임',
      '200만회+ 다운로드',
      STEAM_REVIEW_KR_NOTICE,
    ],
  },
  en: {
    title: 'UnderDark : Defense',
    description:
      "Defense is all about tenacity and making it to the end\nDon't ever give up, no matter what\n\nDefend the final camp!\nTactical indie game <UnderDark : Defense>",
    tags: [
      'Tactical Tower Defense',
      'Overwhelmingly Positive',
      '+2 million downloads',
      'Play now',
    ],
  },
  ja: {
    title: 'UnderDark : Defense',
    // Read off the JP 16:9 video frame (module-5 ✱Do): the first sentence is
    // one line, and the closing line names the game.
    description:
      'ディフェンスなるもの… 最後まで諦めない者が勝利するのだ！\nどんな敵でもネバーギブアップ\n\n基地を守り抜け！\n戦略インディーズゲーム【UnderDark : Defense】',
    tags: [
      '戦略タワーディフェンス',
      '圧倒的な神ゲー',
      '200万+ダウンロード',
      '今すぐプレイ',
    ],
  },
  'zh-TW': {
    title: 'UnderDark : Defense',
    description:
      '堅持到最後的人才是防守遊戲的贏家\n絕對不要放棄\n\n守住最後的營地!\n策略獨立遊戲<UnderDark : Defense>',
    tags: ['策略塔防遊戲', '無負評的超讚遊戲', '超過200萬次下載', '馬上玩'],
  },
};

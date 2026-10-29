/** Chinese option codes read better spelled out; shown with lang="en". */
export const CHINESE_LABELS = {
  'zh-CN': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
};

/** Thin-line globe, check mark and caret, drawn in currentColor. */
export const ICONS = Object.freeze({
  globe: {
    stroke: [
      'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z',
      'M12 3c-2.6 2.5-3.9 5.5-3.9 9s1.3 6.5 3.9 9',
      'M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9',
      'M3 12h18',
      'M4.3 7.5h15.4',
      'M4.3 16.5h15.4',
    ],
  },
  check: { stroke: ['M5 12.5l4.3 4.3L19 7'] },
  caret: { fill: ['M7 10h10l-5 5.5Z'] },
});

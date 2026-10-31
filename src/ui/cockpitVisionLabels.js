import { t } from '../i18n/index.js';

/** Each vision style's short label and its spoken name. */
const LABELS = {
  optical: () => t('NORMAL'),
  crt: () => t('CRT'),
  nvg: () => t('NVG'),
  thermal: () => t('FLIR'),
  anime: () => t('ANIME'),
  noir: () => t('NOIR'),
};
const NAMES = {
  optical: () => t('Normal'),
  crt: () => t('CRT'),
  nvg: () => t('Night vision'),
  thermal: () => t('Thermal'),
  anime: () => t('Anime'),
  noir: () => t('Noir'),
};

/** Resolve vision text for either the mounted view or supplied native controls. */
export function cockpitVisionLabels(mode) {
  return {
    label: (LABELS[mode] ?? LABELS.optical)(),
    name: (NAMES[mode] ?? NAMES.optical)(),
  };
}

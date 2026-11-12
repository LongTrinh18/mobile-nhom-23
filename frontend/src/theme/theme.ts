/** Shared visual contract for every screen. Keep colors and sizes here instead of hard-coding them. */
export const theme = {
  colors: {
    primary: '#FE2C55',
    primaryPressed: '#E3173F',
    primarySoft: '#FFEEF1',
    ink: '#161823',
    text: '#2B2D35',
    muted: '#80838C',
    subtle: '#A8AAB0',
    surface: '#FFFFFF',
    background: '#F4F4F5',
    /** Warm studio backdrop shared by product photos and the category atlas. */
    canvas: '#F1EEE8',
    soft: '#F2F2F3',
    border: '#EBEBED',
    borderStrong: '#D5D6DA',
    danger: '#D92D20',
    dangerSoft: '#FEF3F2',
    success: '#039855',
    successSoft: '#ECFDF3',
    warning: '#C4320A',
    warningSoft: '#FFF6ED',
    info: '#1570EF',
    infoSoft: '#EFF8FF',
    overlay: 'rgba(22, 24, 35, 0.45)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 },
  font: { title: 20, section: 16, body: 14, small: 12, tiny: 11 },
  /** Minimum comfortable touch target on phones. */
  touch: 44,
  shadow: {
    card: { boxShadow: '0px 1px 2px rgba(22, 24, 35, 0.05)' },
    raised: { boxShadow: '0px -2px 10px rgba(22, 24, 35, 0.06)' },
  },
} as const;

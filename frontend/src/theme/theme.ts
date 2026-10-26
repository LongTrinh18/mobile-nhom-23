/** Shared visual contract for A and C. Avoid editing Expo's default src/constants/theme.ts. */
export const theme = {
  colors: {
    primary: '#CF2030',
    primaryPressed: '#AE1525',
    ink: '#17212B',
    muted: '#6D7782',
    surface: '#FFFFFF',
    background: '#F8F8F7',
    soft: '#F0F1F2',
    border: '#E2E5E8',
    danger: '#B42318',
    success: '#137B4A',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 18, pill: 999 },
  font: { title: 27, section: 20, body: 15, small: 12 },
} as const;

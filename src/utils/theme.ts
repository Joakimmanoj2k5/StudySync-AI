export type ThemePresetId = 'forest' | 'ocean' | 'sunrise';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  preview: string[];
  values: Record<string, string>;
}

const STORAGE_KEY = 'learnai_theme_preset';

export const themePresets: ThemePreset[] = [
  {
    id: 'forest',
    name: 'Forest',
    description: 'Deep green workspace with the current neon-study feel.',
    preview: ['#22c55e', '#16a34a', '#0c120e'],
    values: {
      '--color-background': '#050806',
      '--color-foreground': '#fafafa',
      '--color-card': '#0c120e',
      '--color-card-foreground': '#fafafa',
      '--color-popover': '#0c120e',
      '--color-popover-foreground': '#fafafa',
      '--color-primary': '#22c55e',
      '--color-primary-foreground': '#031508',
      '--color-secondary': '#101a13',
      '--color-secondary-foreground': '#fafafa',
      '--color-muted': '#1a231d',
      '--color-muted-foreground': '#9ca3af',
      '--color-accent': '#16a34a',
      '--color-accent-foreground': '#ecfdf5',
      '--color-destructive': '#ef4444',
      '--color-destructive-foreground': '#fafafa',
      '--color-border': '#1f2a24',
      '--color-input': '#1f2a24',
      '--color-ring': '#22c55e',
      '--color-success': '#22c55e',
      '--color-warning': '#f59e0b',
      '--primary-rgb': '34, 197, 94',
      '--accent-rgb': '22, 163, 74',
      '--gradient-1': '#040705',
      '--gradient-2': '#0a120d',
      '--gradient-3': '#060b08',
      '--gradient-4': '#0f1712',
      '--grid-line': 'rgba(34, 197, 94, 0.04)',
      '--glass-bg': 'rgba(8, 12, 10, 0.82)',
      '--glass-border': 'rgba(34, 197, 94, 0.12)',
      '--orb-1': 'rgba(34, 197, 94, 0.30)',
      '--orb-2': 'rgba(16, 185, 129, 0.25)',
      '--orb-3': 'rgba(20, 184, 166, 0.20)',
      '--gradient-text-1': '#22c55e',
      '--gradient-text-2': '#16a34a',
      '--gradient-text-3': '#14532d',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool blue-teal tones for a calmer focus mode.',
    preview: ['#38bdf8', '#14b8a6', '#0b1320'],
    values: {
      '--color-background': '#07111d',
      '--color-foreground': '#eff6ff',
      '--color-card': '#0c1828',
      '--color-card-foreground': '#eff6ff',
      '--color-popover': '#0c1828',
      '--color-popover-foreground': '#eff6ff',
      '--color-primary': '#38bdf8',
      '--color-primary-foreground': '#082f49',
      '--color-secondary': '#122235',
      '--color-secondary-foreground': '#eff6ff',
      '--color-muted': '#1b2d43',
      '--color-muted-foreground': '#9fb3c8',
      '--color-accent': '#14b8a6',
      '--color-accent-foreground': '#ecfeff',
      '--color-destructive': '#ef4444',
      '--color-destructive-foreground': '#fafafa',
      '--color-border': '#22364f',
      '--color-input': '#22364f',
      '--color-ring': '#38bdf8',
      '--color-success': '#14b8a6',
      '--color-warning': '#f59e0b',
      '--primary-rgb': '56, 189, 248',
      '--accent-rgb': '20, 184, 166',
      '--gradient-1': '#07111d',
      '--gradient-2': '#102032',
      '--gradient-3': '#0a1726',
      '--gradient-4': '#12273a',
      '--grid-line': 'rgba(56, 189, 248, 0.05)',
      '--glass-bg': 'rgba(10, 18, 30, 0.84)',
      '--glass-border': 'rgba(56, 189, 248, 0.14)',
      '--orb-1': 'rgba(56, 189, 248, 0.28)',
      '--orb-2': 'rgba(20, 184, 166, 0.24)',
      '--orb-3': 'rgba(96, 165, 250, 0.18)',
      '--gradient-text-1': '#67e8f9',
      '--gradient-text-2': '#38bdf8',
      '--gradient-text-3': '#0f766e',
    },
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    description: 'Warm paper-like theme with softer contrast.',
    preview: ['#d97706', '#ea580c', '#fffdf7'],
    values: {
      '--color-background': '#fcfaf4',
      '--color-foreground': '#2a2117',
      '--color-card': '#fffdf7',
      '--color-card-foreground': '#2a2117',
      '--color-popover': '#fffdf7',
      '--color-popover-foreground': '#2a2117',
      '--color-primary': '#d97706',
      '--color-primary-foreground': '#fff7ed',
      '--color-secondary': '#f4ebdd',
      '--color-secondary-foreground': '#2a2117',
      '--color-muted': '#eadfcd',
      '--color-muted-foreground': '#7b6b58',
      '--color-accent': '#ea580c',
      '--color-accent-foreground': '#fff7ed',
      '--color-destructive': '#dc2626',
      '--color-destructive-foreground': '#fff7ed',
      '--color-border': '#decfb7',
      '--color-input': '#decfb7',
      '--color-ring': '#d97706',
      '--color-success': '#15803d',
      '--color-warning': '#ca8a04',
      '--primary-rgb': '217, 119, 6',
      '--accent-rgb': '234, 88, 12',
      '--gradient-1': '#fcfaf4',
      '--gradient-2': '#f8f0df',
      '--gradient-3': '#fffaf1',
      '--gradient-4': '#efe2c4',
      '--grid-line': 'rgba(217, 119, 6, 0.06)',
      '--glass-bg': 'rgba(255, 252, 244, 0.84)',
      '--glass-border': 'rgba(217, 119, 6, 0.14)',
      '--orb-1': 'rgba(249, 115, 22, 0.20)',
      '--orb-2': 'rgba(245, 158, 11, 0.18)',
      '--orb-3': 'rgba(234, 88, 12, 0.14)',
      '--gradient-text-1': '#f59e0b',
      '--gradient-text-2': '#ea580c',
      '--gradient-text-3': '#9a3412',
    },
  },
];

function getThemeById(id: ThemePresetId): ThemePreset {
  return themePresets.find((theme) => theme.id === id) || themePresets[0];
}

export function getStoredThemePreset(): ThemePresetId {
  if (typeof window === 'undefined') {
    return 'forest';
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY) as ThemePresetId | null;
  if (storedTheme && themePresets.some((theme) => theme.id === storedTheme)) {
    return storedTheme;
  }

  return 'forest';
}

export function applyThemePreset(themeId: ThemePresetId): void {
  if (typeof document === 'undefined') {
    return;
  }

  const theme = getThemeById(themeId);
  const root = document.documentElement;

  Object.entries(theme.values).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  window.localStorage.setItem(STORAGE_KEY, themeId);
}

export function initializeTheme(): ThemePresetId {
  const themeId = getStoredThemePreset();
  applyThemePreset(themeId);
  return themeId;
}

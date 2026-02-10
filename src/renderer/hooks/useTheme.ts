import { useState, useEffect, useCallback } from 'react';
import type { AppearanceMode, ThemeId, Settings } from '../../shared/types';

interface UseThemeReturn {
  appearanceMode: AppearanceMode;
  themeId: ThemeId;
  resolvedTheme: 'light' | 'dark';
  setAppearanceMode: (mode: AppearanceMode) => void;
  setThemeId: (themeId: ThemeId) => void;
}

const DEFAULT_THEME_ID: ThemeId = 'claude';

export function useTheme(): UseThemeReturn {
  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>('system');
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Get system preference
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }, []);

  const resolveTheme = useCallback(
    (mode: AppearanceMode): 'light' | 'dark' => (mode === 'system' ? getSystemTheme() : mode),
    [getSystemTheme]
  );

  const applyAppearance = useCallback((mode: 'light' | 'dark', nextThemeId: ThemeId) => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', nextThemeId);
  }, []);

  // Load saved theme
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const settings = await window.electronAPI.getSettings() as Settings | null;
        const legacyTheme = settings && 'theme' in settings ? (settings as { theme?: AppearanceMode }).theme : undefined;
        if (settings?.appearanceMode || legacyTheme) {
          setAppearanceModeState(settings?.appearanceMode || legacyTheme || 'system');
        }
        if (settings?.themeId) {
          setThemeIdState(settings.themeId);
        }
      } catch (err) {
        console.error('Failed to load theme:', err);
      }
    };
    loadTheme();
  }, []);

  // Apply theme to document
  useEffect(() => {
    const resolved = resolveTheme(appearanceMode);
    setResolvedTheme(resolved);
    applyAppearance(resolved, themeId);
  }, [appearanceMode, themeId, resolveTheme, applyAppearance]);

  // Listen for system theme changes
  useEffect(() => {
    if (appearanceMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const nextResolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(nextResolved);
      applyAppearance(nextResolved, themeId);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [appearanceMode, themeId, applyAppearance]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onSettingsUpdated((settings) => {
      const legacyTheme = settings && 'theme' in settings ? (settings as { theme?: AppearanceMode }).theme : undefined;
      if (settings?.appearanceMode || legacyTheme) {
        setAppearanceModeState(settings?.appearanceMode || legacyTheme || 'system');
      }
      if (settings?.themeId) {
        setThemeIdState(settings.themeId);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const setAppearanceMode = useCallback(async (mode: AppearanceMode) => {
    setAppearanceModeState(mode);
    try {
      await window.electronAPI.setSettings({ appearanceMode: mode });
    } catch (err) {
      console.error('Failed to save appearance mode:', err);
    }
  }, []);

  const setThemeId = useCallback(async (nextThemeId: ThemeId) => {
    setThemeIdState(nextThemeId);
    try {
      await window.electronAPI.setSettings({ themeId: nextThemeId });
    } catch (err) {
      console.error('Failed to save theme:', err);
    }
  }, []);

  return { appearanceMode, themeId, resolvedTheme, setAppearanceMode, setThemeId };
}

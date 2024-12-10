import { Settings } from '../models/Settings';

const SETTINGS_KEY = 'iseetv_settings';

const defaultSettings: Settings = {
  m3uUrl: '',
  epgUrl: '',
  updateInterval: 24,
  updateOnStart: true,
  theme: 'system'
};

export const settingsService = {
  getSettings: (): Settings => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : defaultSettings;
  },

  saveSettings: (settings: Settings): void => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  shouldShowSettings: (): boolean => {
    const settings = settingsService.getSettings();
    return !settings.m3uUrl;
  }
}; 
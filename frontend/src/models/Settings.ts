export interface Settings {
  m3uUrl: string;
  epgUrl?: string;
  updateInterval: number;
  updateOnStart: boolean;
  theme: 'light' | 'dark' | 'system';
  showChannelNumbers: boolean;
} 
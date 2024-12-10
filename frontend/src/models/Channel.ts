export interface Channel {
  id: string;
  name: string;
  url: string;
  group: string;
  logo?: string;
  number?: string;
  isFavorite?: boolean;
  lastWatched?: Date;
} 
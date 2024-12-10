export interface Channel {
  channel_number: number;
  guide_id: string;
  name: string;
  url: string;
  group: string;
  logo?: string;
  isFavorite?: boolean;
  lastWatched?: Date;
} 
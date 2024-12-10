import { Channel } from '../models/Channel';
import { API_URL } from '../config/api';

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

interface ChannelFilters {
  group?: string;
  search?: string;
  favoritesOnly?: boolean;
}

const logStyles = {
  info: 'color: #4CAF50; font-weight: bold',
  error: 'color: #f44336; font-weight: bold',
  warn: 'color: #ff9800; font-weight: bold',
};

export const channelService = {
  async getChannels(
    page: number = 0,
    pageSize: number = 100,
    filters: ChannelFilters = {}
  ): Promise<PaginatedResponse<Channel>> {
    const params = new URLSearchParams({
      skip: (page * pageSize).toString(),
      limit: pageSize.toString(),
      ...(filters.group && { group: filters.group }),
      ...(filters.search && { search: filters.search }),
      ...(filters.favoritesOnly && { favorites_only: 'true' })
    });

    const response = await fetch(`${API_URL}/channels?${params}`);
    if (!response.ok) throw new Error('Failed to fetch channels');
    return response.json();
  },

  async saveChannels(channels: Channel[]): Promise<void> {
    console.log(
      '%c[Channels] Saving %d channels to backend',
      logStyles.info,
      channels.length
    );
    try {
      const response = await fetch(`${API_URL}/channels/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channels)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('%c[Channels] Save error:', logStyles.error, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to save channels: ${errorText}`);
      }

      console.log('%c[Channels] Save successful', logStyles.info);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Channels] Save error details:', {
        message: errorMessage,
        error
      });
      throw error;
    }
  },

  async toggleFavorite(channelId: string): Promise<Channel> {
    const response = await fetch(`${API_URL}/channels/${channelId}/favorite`, {
      method: 'PUT'
    });
    if (!response.ok) throw new Error('Failed to toggle favorite');
    return response.json();
  },

  async refreshM3U(url: string): Promise<void> {
    const response = await fetch(`${API_URL}/m3u/refresh?url=${encodeURIComponent(url)}`, {
      method: 'POST'
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
  }
}; 
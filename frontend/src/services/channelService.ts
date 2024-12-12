import { Channel } from '../models/Channel';
import { ChannelGroup } from '../types/api';
import { API_URL } from '../config/api';

interface GetChannelsParams {
  search?: string;
  group?: string;
  favoritesOnly?: boolean;
} 

interface GetChannelsResponse {
  items: Channel[];
  total: number;
  skip: number;
  limit: number;
}

export const channelService = {
  async getChannels(
    skip: number = 0,
    limit: number = 100,
    params: GetChannelsParams = {}
  ): Promise<GetChannelsResponse> {
    const searchParams = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      ...(params.search && { search: params.search }),
      ...(params.group && { group: params.group }),
      ...(params.favoritesOnly && { favorites_only: 'true' }),
    });

    const response = await fetch(`${API_URL}/channels?${searchParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  async toggleFavorite(channelNumber: number): Promise<Channel> {
    try {
      const response = await fetch(`${API_URL}/channels/${channelNumber}/favorite`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle favorite: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        ...data,
        isFavorite: data.is_favorite,
        lastWatched: data.last_watched ? new Date(data.last_watched) : undefined,
      };
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  },

  async refreshM3U(url: string): Promise<void> {
    const response = await fetch(`${API_URL}/m3u/refresh?url=${encodeURIComponent(url)}`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to refresh M3U: ${response.statusText}`);
    }
  },

  async getGroups(): Promise<ChannelGroup[]> {
    const response = await fetch(`${API_URL}/channels/groups`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  async saveChannels(channels: Channel[]): Promise<void> {
    const response = await fetch(`${API_URL}/channels/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(channels),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  },
}; 
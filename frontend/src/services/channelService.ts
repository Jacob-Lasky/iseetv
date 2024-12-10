import { Channel } from '../models/Channel';
import { ChannelGroup, ProgressCallback } from '../types/api';
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

  async toggleFavorite(channelNumber: number): Promise<Channel> {
    const response = await fetch(
      `${API_URL}/channels/${channelNumber}/favorite`,
      {
        method: 'PUT',
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  async refreshM3U(url: string, onProgress?: ProgressCallback): Promise<void> {
    const response = await fetch(
      `${API_URL}/m3u/refresh?url=${encodeURIComponent(url)}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    // Get the reader from the response body
    const reader = response.body?.getReader();
    const contentLength = +(response.headers.get('Content-Length') ?? '0');

    if (reader && onProgress) {
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        receivedLength += value.length;
        onProgress(receivedLength, contentLength);
      }
    }
  },

  async getGroups(): Promise<ChannelGroup[]> {
    const response = await fetch(`${API_URL}/channels/groups`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
}; 
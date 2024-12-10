import { Channel } from '../models/Channel';
import { channelService } from './channelService';

export {};

interface ProgressCallback {
  (loaded: number, total: number): void;
}

const logStyles = {
  info: 'color: #4CAF50; font-weight: bold',  // Green
  error: 'color: #f44336; font-weight: bold', // Red
  warn: 'color: #ff9800; font-weight: bold',  // Orange
};

export const m3uService = {
  async parseM3U(url: string, onProgress?: ProgressCallback): Promise<Channel[]> {
    try {
      console.log('%c[M3U] Starting download from %s', logStyles.info, url);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(
          '%c[M3U] HTTP error: %s %s', 
          logStyles.error,
          response.status,
          response.statusText
        );
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const contentLength = +(response.headers.get('Content-Length') ?? '0');
      
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let receivedLength = 0;
      let chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (onProgress) {
          onProgress(receivedLength, contentLength);
        }
      }

      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      const text = new TextDecoder('utf-8').decode(chunksAll);
      console.log(
        '%c[M3U] Downloaded %sMB', 
        logStyles.info,
        (receivedLength / 1024 / 1024).toFixed(2)
      );

      const lines = text.split('\n');
      console.log(`[M3U] Parsing ${lines.length} lines`);
      
      const channels: Channel[] = [];
      let currentChannel: Partial<Channel> = {
        channel_number: 0,
        guide_id: '',
        name: '',
        group: 'Default',
        isFavorite: false
      };

      lines.forEach((line, index) => {
        line = line.trim();
        
        if (line.startsWith('#EXTINF:')) {
          // Parse channel info
          const info = line.substring(8).split(',');
          const attributes = info[0].match(/([a-zA-Z-]+)="([^"]*)"/g);
          
          currentChannel = {
            channel_number: index + 1,
            guide_id: `channel-${index}`,
            name: info[1].trim(),
            group: 'Default',
            isFavorite: false
          };

          // Parse attributes
          attributes?.forEach(attr => {
            const [key, value] = attr.split('=');
            const cleanValue = value.replace(/"/g, '');
            
            switch (key) {
              case 'tvg-logo':
                currentChannel.logo = cleanValue;
                break;
              case 'group-title':
                currentChannel.group = cleanValue;
                break;
              case 'tvg-id':
                currentChannel.guide_id = cleanValue;
                break;
              case 'tvg-name':
                currentChannel.name = cleanValue || currentChannel.name;
                break;
            }
          });
        } else if (line.startsWith('http')) {
          currentChannel.url = line;
          if (currentChannel.name && currentChannel.url) {
            channels.push(currentChannel as Channel);
          }
          currentChannel = {};
        }
      });

      console.log(`[M3U] Found ${channels.length} channels in ${Object.keys(
        channels.reduce((acc, c) => ({ ...acc, [c.group]: true }), {})
      ).length} groups`);

      console.log('[M3U] Saving channels to database...');
      await channelService.saveChannels(channels);
      console.log('[M3U] Channels saved successfully');

      return channels;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('%c[M3U] Error details:', logStyles.error, {
        message: errorMessage,
        error,
        url
      });
      throw error;
    }
  }
}; 
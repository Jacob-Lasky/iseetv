export interface ChannelGroup {
  name: string;
  count: number;
}

export interface ProgressCallback {
  (loaded: number, total: number): void;
} 
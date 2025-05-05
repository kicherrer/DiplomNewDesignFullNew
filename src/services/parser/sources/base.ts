import { VideoContent } from '@prisma/client';

export type { VideoContent };

export interface VideoSourceAPI {
  getContent(query: string): Promise<VideoContent[]>;
  getTrailer?(query: string): Promise<VideoContent | null>;
  getPosters(query: string): Promise<string[]>;
  getBackdrops(query: string): Promise<string[]>;
  getMetadata(query: string): Promise<MediaMetadata>;
  getStreamUrl?(videoId: string): Promise<string>;
  getSubtitles?(videoId: string): Promise<SubtitleTrack[]>;
  getAudioTracks?(videoId: string): Promise<AudioTrack[]>;
}

export interface SubtitleTrack {
  language: string;
  url: string;
  label?: string;
}

export interface AudioTrack {
  language: string;
  url: string;
  label?: string;
  isDefault?: boolean;
}

export interface MediaMetadata {
  title: string;
  original_title?: string;
  description?: string;
  release_date?: Date;
  rating?: number;
  duration?: number;
  actors?: string[];
  director?: string;
  writers?: string[];
  crew?: Record<string, any>;
  genres?: string[];
  posters?: string[];
  backdrops?: string[];
}

export interface VideoQuality {
  resolution: string;
  url: string;
  size?: number;
}

export interface VideoDetails {
  url: string;
  quality: string;
  source: string;
  subtitles?: string[];
  audio?: string[];
}
import { MediaType, MediaStatus } from '@prisma/client';

export interface Media {
  id: number;
  title: string;
  original_title?: string;
  type: MediaType;
  description?: string;
  poster_url?: string;
  backdrop_url?: string;
  release_date?: Date;
  rating: number;
  duration?: number;
  views: number;
  status: MediaStatus;
  source_id?: string;
  source_type?: string;
  created_at: Date;
  updated_at: Date;
  genres?: Genre[];
  episodes?: Episode[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface Episode {
  id: number;
  title: string;
  episode_number: number;
  season_number: number;
  air_date?: Date;
  description?: string;
  media_id: number;
}

export interface ParserStatus {
  id: number;
  status: string;
  lastRun: Date;
  processedItems: number;
  errors: string[];
}

export interface Season {
  seasonNumber: number;
  episodes: Episode[];
}

export interface SeriesData {
  seasons: Season[];
}
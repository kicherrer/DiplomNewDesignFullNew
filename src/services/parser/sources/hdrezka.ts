import axios from 'axios';
import { VideoSourceAPI, MediaMetadata, VideoContent } from './base';

export class HDRezkaAPI implements VideoSourceAPI {
  async getTrailer(query: string): Promise<VideoContent | null> {
    try {
      const searchResult = await this.makeRequest('/search/trailer', { query });
      if (searchResult.trailer) {
        return {
          url: searchResult.trailer.url,
          quality: searchResult.trailer.quality || 'HD',
          type: 'trailer',
          source: 'hdrezka'
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting trailer from HDRezka:', error);
      return null;
    }
  }
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string = '') {
    this.baseUrl = 'https://rezka.ag'; // Актуальный домен HDRezka
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: {
          ...params,
          api_key: this.apiKey
        },
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': this.baseUrl
        }
      });
      return response.data;
    } catch (error) {
      console.error('HDRezka API error:', error);
      throw error;
    }
  }

  async getContent(query: string): Promise<VideoContent[]> {
    try {
      const searchResult = await this.makeRequest('/search', { query });
      const videos: VideoContent[] = [];

      for (const item of searchResult.items || []) {
        if (item.videos) {
          videos.push({
            url: item.videos.url,
            quality: item.videos.quality,
            source: 'hdrezka',
            subtitles: item.videos.subtitles,
            audio: item.videos.audio
          });
        }
      }

      return videos;
    } catch (error) {
      console.error('Error getting content from HDRezka:', error);
      return [];
    }
  }

  async getPosters(query: string): Promise<string[]> {
    try {
      const result = await this.makeRequest('/images/posters', { query });
      return result.posters || [];
    } catch (error) {
      console.error('Error getting posters from HDRezka:', error);
      return [];
    }
  }

  async getBackdrops(query: string): Promise<string[]> {
    try {
      const result = await this.makeRequest('/images/backdrops', { query });
      return result.backdrops || [];
    } catch (error) {
      console.error('Error getting backdrops from HDRezka:', error);
      return [];
    }
  }

  async getMetadata(query: string): Promise<MediaMetadata> {
    try {
      const result = await this.makeRequest('/metadata', { query });
      
      return {
        title: result.title,
        original_title: result.original_title,
        description: result.description,
        release_date: result.release_date ? new Date(result.release_date) : undefined,
        rating: result.rating,
        duration: result.duration,
        actors: result.actors,
        director: result.director,
        writers: result.writers,
        crew: result.crew,
        genres: result.genres,
        posters: await this.getPosters(query),
        backdrops: await this.getBackdrops(query)
      };
    } catch (error) {
      console.error('Error getting metadata from HDRezka:', error);
      return {
        title: query
      };
    }
  }
}
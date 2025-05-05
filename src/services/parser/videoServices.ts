import axios from 'axios';

interface VideoSource {
  url: string;
  quality: string;
  type: 'movie' | 'series' | 'trailer';
  source: string;
}

export class VideoServices {
  private readonly YOUTUBE_API_KEY = 'AIzaSyB9ikMj4-FUxvabABqhjqUNyJlEGp9N9VY';
  private readonly HDREZKA_API_URL = 'https://hdrezka-api.com/api/v1';
  private readonly KINOBASE_API_URL = 'https://kinobase-api.com/api/v1';
  private readonly HDVIDEOBOX_API_URL = 'https://hdvideobox-api.com/api/v1';
  private readonly VIDEOCDN_API_URL = 'https://videocdn.tv/api';

  async getVideoSources(mediaId: string, type: 'movie' | 'series'): Promise<VideoSource[]> {
    const sources: VideoSource[] = [];

    // Пробуем получить видео из HDRezka
    try {
      const hdrezkaSources = await this.getHDRezkaSources(mediaId, type);
      sources.push(...hdrezkaSources);
    } catch (error) {
      console.error('HDRezka API error:', error);
    }

    // Если HDRezka не дала результатов, пробуем Kinobase
    if (sources.length === 0) {
      try {
        const kinobaseSources = await this.getKinobaseSources(mediaId, type);
        sources.push(...kinobaseSources);
      } catch (error) {
        console.error('Kinobase API error:', error);
      }
    }

    // Если Kinobase не дала результатов, пробуем HDVideoBox
    if (sources.length === 0) {
      try {
        const hdvideoboxSources = await this.getHDVideoBoxSources(mediaId, type);
        sources.push(...hdvideoboxSources);
      } catch (error) {
        console.error('HDVideoBox API error:', error);
      }
    }

    // Если HDVideoBox не дала результатов, пробуем VideoCDN
    if (sources.length === 0) {
      try {
        const videoCdnSources = await this.getVideoCDNSources(mediaId, type);
        sources.push(...videoCdnSources);
      } catch (error) {
        console.error('VideoCDN API error:', error);
      }
    }

    return sources;
  }

  async getTrailer(mediaTitle: string): Promise<VideoSource | null> {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: `${mediaTitle} трейлер`,
          type: 'video',
          maxResults: 1,
          key: this.YOUTUBE_API_KEY
        }
      });

      if (response.data.items && response.data.items.length > 0) {
        const videoId = response.data.items[0].id.videoId;
        return {
          url: `https://www.youtube.com/watch?v=${videoId}`,
          quality: 'HD',
          type: 'trailer',
          source: 'youtube'
        };
      }
      return null;
    } catch (error) {
      console.error('YouTube API error:', error);
      return null;
    }
  }

  private async getHDRezkaSources(mediaId: string, type: 'movie' | 'series'): Promise<VideoSource[]> {
    // Реализация получения видео из HDRezka API
    return [];
  }

  private async getKinobaseSources(mediaId: string, type: 'movie' | 'series'): Promise<VideoSource[]> {
    // Реализация получения видео из Kinobase API
    return [];
  }

  private async getHDVideoBoxSources(mediaId: string, type: 'movie' | 'series'): Promise<VideoSource[]> {
    // Реализация получения видео из HDVideoBox API
    return [];
  }

  private async getVideoCDNSources(mediaId: string, type: 'movie' | 'series'): Promise<VideoSource[]> {
    // Реализация получения видео из VideoCDN API
    return [];
  }
}
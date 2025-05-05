import axios from 'axios';
import { VideoSourceAPI, VideoContent } from './base';
import { VideoType, VideoStatus } from '@prisma/client';
import { YouTubeSearchResponse, YouTubeVideoResponse, YouTubeSearchItem, ScoredVideo } from './youtube.types';

export class YouTubeAPI implements Partial<VideoSourceAPI> {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';
  private readonly maxRetries = 5;
  private readonly retryDelay = 2000; // задержка между попытками в миллисекундах
  private readonly exponentialBackoff = true; // использовать экспоненциальную задержку
  private readonly maxDelay = 60000; // максимальная задержка между попытками (1 минута)

  constructor(apiKey: string) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('Необходимо предоставить действительный API ключ YouTube');
    }
    this.apiKey = apiKey.trim();
  }

  private validateApiKey(): void {
    if (!this.apiKey || typeof this.apiKey !== 'string' || this.apiKey.trim().length === 0) {
      throw new Error('Отсутствует действительный API ключ YouTube');
    }
  }

  private calculateDelay(attempts: number): number {
    const delay = this.exponentialBackoff
      ? Math.min(this.retryDelay * Math.pow(2, attempts), this.maxDelay)
      : this.retryDelay;
    return Math.floor(delay * (0.8 + Math.random() * 0.4)); // Добавляем случайность ±20%
  }

  private async makeRequest<T extends YouTubeSearchResponse | YouTubeVideoResponse>(url: string, params: Record<string, string | number | boolean>): Promise<T | null> {
    this.validateApiKey();
    let attempts = 0;
    
    while (attempts < this.maxRetries) {
      try {
        const response = await axios.get<T>(url, {
          params: { ...params, key: this.apiKey },
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 10000, // таймаут 10 секунд
          validateStatus: (status) => status < 500
        });

        if (response.status === 403) {
          console.error('Ошибка авторизации YouTube API. Проверьте валидность API ключа.');
          return null;
        }

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers['retry-after']) * 1000 || this.calculateDelay(attempts);
          console.warn(`Превышен лимит запросов. Попытка ${attempts + 1}/${this.maxRetries}. Ожидание ${retryAfter}мс...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          attempts++;
          continue;
        }

        if (response.status !== 200) {
          console.error(`Ошибка API YouTube: ${response.status}`, response.data);
          return null;
        }

        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const errorData = error.response?.data;
          
          console.error(`Ошибка запроса к YouTube API (${status}):`, {
            message: error.message,
            code: errorData?.error?.code,
            reason: errorData?.error?.errors?.[0]?.reason,
            details: errorData?.error?.message
          });

          // Проверяем специфические ошибки YouTube API
          if (status === 400) {
            console.error('Неверный запрос. Проверьте параметры запроса.');
            return null;
          } else if (status === 401 || status === 403) {
            console.error('Ошибка аутентификации. Проверьте API ключ.');
            return null;
          }
        } else {
          console.error('Неизвестная ошибка при запросе к API:', error);
        }
        
        if (attempts < this.maxRetries - 1) {
          const retryDelay = this.calculateDelay(attempts);
          console.warn(`Повторная попытка через ${retryDelay}мс...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          attempts++;
          continue;
        }
        return null;
      }
    }
    return null;
  }

  private validateSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      throw new Error('Поисковый запрос должен быть непустой строкой');
    }
    return query.trim();
  }

  private async searchVideo(query: string): Promise<string | null> {
    try {
      const validatedQuery = this.validateSearchQuery(query);

      const searchParams = {
        part: 'snippet',
        q: `${validatedQuery} трейлер официальный`,
        type: 'video',
        maxResults: 10, // Увеличиваем количество результатов для лучшего поиска
        regionCode: 'RU',
        videoDefinition: 'high',
        videoDuration: 'short',
        relevanceLanguage: 'ru',
        safeSearch: 'moderate',
        order: 'relevance', // Сортировка по релевантности
        videoEmbeddable: 'true' // Только встраиваемые видео
      };

      let data = await this.makeRequest<YouTubeSearchResponse>(`${this.baseUrl}/search`, searchParams);

      if (!data?.items?.length) {
        console.warn('Трейлеры не найдены для запроса:', validatedQuery);
        // Пробуем искать без слова "официальный"
        searchParams.q = `${validatedQuery} трейлер`;
        const alternativeData = await this.makeRequest<YouTubeSearchResponse>(`${this.baseUrl}/search`, searchParams);
        if (!alternativeData?.items?.length) {
          console.error('Не удалось найти подходящие трейлеры');
          return null;
        }
        data = alternativeData; // Заменяем весь объект data вместо только items
      }

      if (!data || !data.items) {
        console.error('Отсутствуют данные о видео в ответе API');
        return null;
      }

      // Улучшенная фильтрация результатов
      const scoredResults: ScoredVideo[] = data.items
        .filter((item: YouTubeSearchItem) => item.id?.videoId && item.snippet?.title)
        .map((item: YouTubeSearchItem) => {
          const title = item.snippet.title.toLowerCase();
          let score = 0;

          // Базовые критерии
          if (title.includes('трейлер') || title.includes('trailer')) score += 3;
          if (title.includes('официальный') || title.includes('official')) score += 2;
          
          // Негативные критерии
          if (title.includes('gameplay') || title.includes('геймплей')) score -= 5;
          if (title.includes('реакция') || title.includes('reaction')) score -= 5;
          if (title.includes('обзор') || title.includes('review')) score -= 3;
          if (title.includes('прохождение') || title.includes('walkthrough')) score -= 5;

          return { id: item.id.videoId, score, title };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scoredResults.length > 0) {
        console.log(`Найден наиболее релевантный трейлер: ${scoredResults[0].title}`);
        return scoredResults[0].id;
      }

      console.log('Трейлер не найден в YouTube');
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Ошибка запроса к YouTube API: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data
        });
      } else {
        console.error('Неизвестная ошибка при поиске видео:', error);
      }
      return null;
    }
  }

  private validateVideoId(videoId: string): string {
    if (!videoId || typeof videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      throw new Error('Недействительный идентификатор видео YouTube');
    }
    return videoId;
  }

  private parseDuration(duration: string): number {
    try {
      const matches = duration.match(/PT(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/);
      if (!matches) return 0;

      const [hours, minutes, seconds] = matches.slice(1).map(x => parseInt(x) || 0);
      return hours * 3600 + minutes * 60 + seconds;
    } catch (error) {
      console.warn('Ошибка при парсинге длительности видео:', error);
      return 0;
    }
  }

  private async getVideoDetails(videoId: string): Promise<VideoContent | null> {
    try {
      const validatedVideoId = this.validateVideoId(videoId);

      const videoParams = {
        part: 'snippet,contentDetails,statistics,status',
        id: validatedVideoId
      };

      const data = await this.makeRequest<YouTubeVideoResponse>(`${this.baseUrl}/videos`, videoParams);

      if (!data || !data.items || data.items.length === 0) {
        console.error('Видео не найдено или недоступно:', videoId);
        return null;
      }

      const video = data.items[0];
      if (!video?.snippet || !video?.contentDetails || !video?.status) {
        console.error('Отсутствуют необходимые данные о видео:', videoId);
        return null;
      }

      // Проверяем доступность видео
      if (video.status.privacyStatus !== 'public') {
        console.error('Видео недоступно для просмотра:', video.status.privacyStatus);
        return null;
      }

      // Проверяем длительность видео (не более 5 минут для трейлера)
      const durationInSeconds = this.parseDuration(video.contentDetails.duration || '0');
      if (durationInSeconds === 0) {
        console.error('Не удалось определить длительность видео');
        return null;
      }
      if (durationInSeconds > 300) {
        console.warn('Видео слишком длинное для трейлера:', durationInSeconds, 'секунд');
        return null;
      }
      if (durationInSeconds < 30) {
        console.warn('Видео слишком короткое для трейлера:', durationInSeconds, 'секунд');
        return null;
      }

      // Проверяем качество видео
      const hasHDQuality = video.contentDetails.definition === 'hd';
      if (!hasHDQuality) {
        console.warn('Видео не в HD качестве');
      }

      // Проверяем название видео на соответствие трейлеру
      const title = video.snippet.title?.toLowerCase() || '';
      const description = video.snippet.description?.toLowerCase() || '';
      const isTrailer = 
        (title.includes('трейлер') || title.includes('trailer')) ||
        (description.includes('трейлер') || description.includes('trailer'));

      if (!isTrailer) {
        console.warn('Видео может не быть трейлером:', title);
        return null;
      }

      return {
        id: 0,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        quality: 'hd',
        type: VideoType.TRAILER,
        format: 'mp4',
        title: video.snippet.title || null,
        description: video.snippet.description || null,
        duration: durationInSeconds,
        size: null,
        status: VideoStatus.READY,
        created_at: new Date(),
        updated_at: new Date(),
        media_trailer_id: null,
        media_video_id: null
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Ошибка при получении информации о видео: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data
        });
      } else {
        console.error('Неизвестная ошибка при получении информации о видео:', error);
      }
      return null;
    }
  }

  async getTrailer(query: string): Promise<VideoContent | null> {
    const videoId = await this.searchVideo(query);
    if (!videoId) return null;

    return await this.getVideoDetails(videoId);
  }

  // Реализуем только необходимые методы для трейлеров
  async getContent(): Promise<VideoContent[]> {
    return [];
  }

  async getPosters(): Promise<string[]> {
    return [];
  }

  async getBackdrops(): Promise<string[]> {
    return [];
  }
}
import axios from 'axios';
import { VideoSourceAPI, VideoContent } from './base';
import { VideoType, VideoStatus } from '@prisma/client';
import { YouTubeSearchResponse, YouTubeVideoResponse, YouTubeSearchItem, ScoredVideo } from './youtube.types';

import { YouTubeAPIKeyManager } from './youtube.config';

export class YouTubeAPI implements Partial<VideoSourceAPI> {
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';
  private readonly maxRetries = 5;
  private readonly retryDelay = 2000;
  private readonly exponentialBackoff = true;
  private readonly maxDelay = 60000;
  private readonly keyManager: YouTubeAPIKeyManager;
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheExpiration = 24 * 60 * 60 * 1000; // 24 часа

  constructor(apiKeys: string[]) {
    if (!apiKeys?.length) {
      throw new Error('Необходимо предоставить хотя бы один действительный API ключ YouTube');
    }
    this.keyManager = new YouTubeAPIKeyManager({
      keys: apiKeys,
      quotaLimitPerKey: 10000,
      quotaResetIntervalHours: 24
    });
  }

  private validateApiKey(apiKey: string): void {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('Отсутствует действительный API ключ YouTube');
    }
    
    if (!apiKey.startsWith('AIza')) {
      throw new Error('Неверный формат API ключа YouTube. Ключ должен начинаться с "AIza"');
    }
  }

  private calculateDelay(attempts: number): number {
    const delay = this.exponentialBackoff
      ? Math.min(this.retryDelay * Math.pow(2, attempts), this.maxDelay)
      : this.retryDelay;
    return Math.floor(delay * (0.8 + Math.random() * 0.4)); // Добавляем случайность ±20%
  }

  private async makeRequest<T extends YouTubeSearchResponse | YouTubeVideoResponse>(url: string, params: Record<string, string | number | boolean>): Promise<T | null> {
    const cacheKey = `${url}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiration) {
      return cached.data;
    }

    let apiKey = await this.keyManager.getAvailableKey();
    this.validateApiKey(apiKey);
    let attempts = 0;
    
    while (attempts < this.maxRetries) {
      try {
        const response = await axios.get<T>(url, {
          params: { ...params, key: apiKey },
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 10000, // таймаут 10 секунд
          validateStatus: (status) => status < 500
        });

        if (response.status === 403) {
          const errorData = response.data?.error;
          const errorMessage = errorData?.message || 'Неизвестная ошибка';
          const errorReason = errorData?.errors?.[0]?.reason || 'unknown';
          
          console.error('Ошибка авторизации YouTube API:', {
            status: response.status,
            message: errorMessage,
            reason: errorReason,
            key: apiKey.substring(0, 8) + '...' // Логируем только начало ключа для безопасности
          });
          
          if (errorReason === 'quotaExceeded') {
            this.keyManager.markKeyAsExhausted();
            // Получаем новый ключ и пробуем снова
            try {
              apiKey = await this.keyManager.getAvailableKey();
              this.validateApiKey(apiKey);
              continue;
            } catch (error) {
              throw new Error('Все API ключи YouTube исчерпали свою квоту. Попробуйте позже.');
            }
          }
          
          if (errorReason === 'keyInvalid') {
            throw new Error('API ключ YouTube недействителен. Пожалуйста, проверьте ключ в консоли Google Cloud.');
          } else if (errorReason === 'accessNotConfigured') {
            throw new Error('API YouTube Data v3 не активирован для этого проекта. Активируйте его в консоли Google Cloud.');
          } else {
            throw new Error(`Ошибка авторизации YouTube API: ${errorMessage}`);
          }
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

        const result = response.data;
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
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
        q: `${validatedQuery} трейлер официальный фильм`,
        type: 'video',
        maxResults: 10,
        regionCode: 'RU',
        videoDefinition: 'high',
        videoDuration: 'short',
        relevanceLanguage: 'ru',
        safeSearch: 'moderate',
        order: 'relevance',
        videoEmbeddable: 'true'
      };

      // Добавляем задержку перед каждым поиском
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      let data = await this.makeRequest<YouTubeSearchResponse>(`${this.baseUrl}/search`, searchParams);

      if (!data?.items?.length) {
        console.warn('Трейлеры не найдены для запроса:', validatedQuery);
        // Пробуем искать без слова "официальный"
        searchParams.q = `${validatedQuery} трейлер фильм`;
        // Добавляем задержку перед повторным поиском
        await new Promise(resolve => setTimeout(resolve, 15000));
        const alternativeData = await this.makeRequest<YouTubeSearchResponse>(`${this.baseUrl}/search`, searchParams);
        if (!alternativeData?.items?.length) {
          console.error('Не удалось найти подходящие трейлеры');
          return null;
        }
        data = alternativeData;
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
          const description = (item.snippet.description || '').toLowerCase();
          let score = 0;

          // Базовые критерии
          if (title.includes('трейлер') || title.includes('trailer')) score += 3;
          if (title.includes('официальный') || title.includes('official')) score += 2;
          if (title.includes('тизер') || title.includes('teaser')) score += 2;
          if (description.includes('трейлер') || description.includes('trailer')) score += 1;
          
          // Проверка на соответствие запросу
          const queryWords = validatedQuery.toLowerCase().split(' ').filter(word => word.length > 2);
          const matchingWords = queryWords.filter(word => 
            word.length > 3 && (title.includes(word) || description.includes(word))
          );
          score += matchingWords.length * 2;
          
          // Негативные критерии
          if (title.includes('gameplay') || title.includes('геймплей')) score -= 5;
          if (title.includes('реакция') || title.includes('reaction')) score -= 5;
          if (title.includes('обзор') || title.includes('review')) score -= 3;
          if (title.includes('прохождение') || title.includes('walkthrough')) score -= 5;
          if (title.includes('fan') || title.includes('фан')) score -= 2;
          if (title.includes('cover') || title.includes('кавер')) score -= 2;

          return { id: item.id.videoId, score, title };
        })
        .filter(item => item.score >= 4) // Увеличиваем минимальный порог релевантности
        .sort((a, b) => b.score - a.score);

      if (scoredResults.length > 0) {
        const bestMatch = scoredResults[0];
        console.log(`Найден релевантный трейлер: ${bestMatch.title} (рейтинг: ${bestMatch.score})`);
        return bestMatch.id;
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

      // Вычисляем score на основе характеристик видео
      let score = 0;
      if (hasHDQuality) score += 20;
      if (durationInSeconds >= 60 && durationInSeconds <= 180) score += 30;
      if (title.includes('официальный') || title.includes('official')) score += 25;
      
      // Определяем, является ли трейлер русскоязычным
      const isRussian = title.includes('русский') || 
                       title.includes('дубляж') || 
                       title.includes('дублированный') || 
                       description.includes('русский трейлер');
      if (isRussian) score += 25;

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
        media_video_id: null,
        score: score,
        is_russian: isRussian
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
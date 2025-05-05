import axios, { AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';
import { VideoContent, VideoType, VideoStatus } from '@prisma/client';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import type { AxiosInstance } from 'axios';

interface RequestConfig extends AxiosRequestConfig {
  jar?: CookieJar;
  proxy?: ProxyConfig;
}

interface RequestError {
  status?: number;
  message: string;
  code?: string;
  data?: unknown;
}

interface SearchResult {
  title: string;
  link: string;
  description?: string;
  rating?: string;
  year?: string;
  genre?: string;
}

interface VideoData {
  streams: Record<string, string>;
  quality: string[];
}

interface QueueItem {
  query: string;
  metadata?: Record<string, unknown>;
  retryCount?: number;
}

interface ProxyConfig {
  host: string;
  port: number;
  protocol: string;
  auth?: {
    username: string;
    password: string;
  };
}

interface VideoStream {
  url: string;
  quality: string;
  format: 'hls' | 'mp4';
}

interface PlayerData {
  streams: Record<string, string>;
  quality: string[];
}

export class RezkaParser {
  private readonly BASE_URL = 'https://rezka.ag';
  private cookieJar: CookieJar;
  private axiosInstance!: AxiosInstance;
  private proxyList: ProxyConfig[] = [];
  private currentProxyIndex = 0;
  private readonly minDelay = 15000;
  private readonly maxDelay = 30000;
  private readonly maxRetries = 3;
  private readonly maxProxyRetries = 2;
  private readonly errorDelay = 45000;
  private isRunning = false;
  private processingQueue: QueueItem[] = [];
  private consecutiveProxyErrors = 0;
  private readonly maxConsecutiveProxyErrors = 3;
  private readonly USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  ];

  constructor(proxyList?: ProxyConfig[]) {
    this.cookieJar = new CookieJar();
    this.proxyList = proxyList || [];
    this.initializeAxiosInstance();
  }

  private getRandomUserAgent(): string {
    return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateDelay(attempt: number): number {
    const baseDelay = this.minDelay;
    const maxDelay = this.maxDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const randomFactor = 0.5 + Math.random();
    return Math.min(maxDelay, Math.floor(exponentialDelay * randomFactor));
  }

  private initializeAxiosInstance(proxy?: ProxyConfig): void {
    const config: RequestConfig = {
      withCredentials: true,
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      timeout: 15000,
      maxRedirects: 5,
      jar: this.cookieJar
    };

    if (proxy) {
      config.proxy = {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        auth: proxy.auth
      };
    }

    this.axiosInstance = wrapper(axios.create(config));
  }

  private rotateProxy(): boolean {
    if (this.proxyList.length === 0) return false;
    
    this.consecutiveProxyErrors++;
    if (this.consecutiveProxyErrors >= this.maxConsecutiveProxyErrors) {
      console.error('Превышено количество последовательных ошибок прокси');
      // Сбрасываем счетчик ошибок и пробуем начать сначала
      this.consecutiveProxyErrors = 0;
      this.currentProxyIndex = 0;
      return false;
    }

    // Используем случайный выбор прокси вместо последовательного
    const availableProxies = this.proxyList.filter((_, index) => index !== this.currentProxyIndex);
    if (availableProxies.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableProxies.length);
      const newProxyIndex = this.proxyList.indexOf(availableProxies[randomIndex]);
      this.currentProxyIndex = newProxyIndex;
    } else {
      // Если нет доступных прокси, возвращаемся к началу списка
      this.currentProxyIndex = 0;
    }

    const proxy = this.proxyList[this.currentProxyIndex];
    this.initializeAxiosInstance(proxy);
    console.log(`Переключение на прокси: ${proxy.host}:${proxy.port} (попытка ${this.consecutiveProxyErrors}/${this.maxConsecutiveProxyErrors})`);
    return true;
  }

  private async makeRequest(url: string, retries = 5): Promise<AxiosResponse<string>> {
    if (!url || !url.startsWith(this.BASE_URL)) {
      throw new Error('Некорректный URL для запроса');
    }

    let lastError: RequestError | null = null;
    let proxyRotationCount = 0;
    const maxProxyRotations = this.proxyList.length * 2; // Позволяем использовать каждый прокси дважды

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (attempt > 0) {
          const currentDelay = this.calculateDelay(attempt);
          console.log(`Попытка ${attempt + 1}/${retries}. Ожидание ${currentDelay}мс...`);
          await this.delay(currentDelay);
        }

        const response = await this.axiosInstance.get<string>(url, {
          validateStatus: (status) => status < 500,
          timeout: 30000 // Увеличиваем таймаут до 30 секунд
        });

        if (response.status === 200) {
          // Успешный запрос - сбрасываем счетчик ошибок
          this.consecutiveProxyErrors = 0;
          return response;
        }

        if (response.status === 429 || response.status === 403) {
          const retryAfter = parseInt(response.headers['retry-after']) * 1000 || this.calculateDelay(attempt);
          console.warn(`Ошибка доступа (${response.status}). Ожидание ${retryAfter}мс...`);
          await this.delay(retryAfter);
          
          if (proxyRotationCount < maxProxyRotations && this.rotateProxy()) {
            proxyRotationCount++;
            // Уменьшаем счетчик попыток, чтобы дать новому прокси больше шансов
            attempt = Math.max(0, attempt - 1);
          }
          continue;
        }

        if (response.status >= 400) {
          lastError = {
            status: response.status,
            message: `HTTP ошибка: ${response.status}`,
            data: response.data
          };
          continue;
        }

        return response;
      } catch (error) {
        const isNetworkError = error instanceof AxiosError && (
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNREFUSED' ||
          error.message.includes('timeout')
        );

        lastError = {
          message: error instanceof Error ? error.message : 'Неизвестная ошибка',
          status: error instanceof AxiosError ? error.response?.status : undefined,
          code: error instanceof AxiosError ? error.code : undefined,
          data: error instanceof AxiosError ? error.response?.data : undefined
        };

        console.error('Ошибка при выполнении запроса:', lastError);

        if (attempt < retries - 1) {
          if (isNetworkError && proxyRotationCount < maxProxyRotations && this.rotateProxy()) {
            proxyRotationCount++;
            // При сетевых ошибках даем прокси еще один шанс
            attempt = Math.max(0, attempt - 1);
          }
          continue;
        }
        break;
      }
    }

    throw new Error(
      lastError
        ? `Превышено максимальное количество попыток. Последняя ошибка: ${lastError.message}`
        : 'Превышено максимальное количество попыток'
    );
  }

  private async extractVideoUrls(playerData: string): Promise<VideoContent[]> {
    if (!playerData || typeof playerData !== 'string') {
      throw new Error('Некорректные данные плеера');
    }

    try {
      const decodedData = JSON.parse(playerData) as PlayerData;
      const videos: VideoContent[] = [];

      if (!decodedData || !decodedData.streams || typeof decodedData.streams !== 'object') {
        throw new Error('Отсутствуют или некорректны данные потоков');
      }

      const videoStreams = Object.entries(decodedData.streams)
        .filter((entry): entry is [string, string] => {
          const [quality, url] = entry;
          return typeof url === 'string' && url.trim().length > 0 && typeof quality === 'string';
        })
        .map(([quality, url]): VideoStream => ({
          quality: quality.toLowerCase(),
          url: url.trim(),
          format: url.toLowerCase().endsWith('.m3u8') ? 'hls' : 'mp4'
        }));

      if (videoStreams.length === 0) {
        console.warn('Не найдено доступных видеопотоков');
        return [];
      }

      videoStreams.forEach(({ quality, url, format }) => {
        videos.push({
          url,
          quality,
          type: VideoType.FULL_MOVIE,
          format,
          status: VideoStatus.PENDING,
          created_at: new Date(),
          updated_at: new Date(),
          id: 0,
          title: null,
          description: null,
          duration: null,
          size: null,
          media_video_id: null,
          media_trailer_id: null
        });
      });

      console.log(`Успешно извлечено ${videos.length} ссылок на видео`);
      return videos;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('Ошибка при разборе данных плеера:', error.message);
        throw new Error(`Некорректный формат данных плеера: ${error.message}`);
      }
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('Ошибка при извлечении ссылок на видео:', errorMessage);
      throw error;
    }
  }

  async searchContent(query: string): Promise<VideoContent[]> {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Поисковый запрос должен быть непустой строкой');
    }

    if (!this.isRunning) {
      console.log('Парсер остановлен');
      return [];
    }

    try {
      const searchUrl = `${this.BASE_URL}/search/?do=search&subaction=search&q=${encodeURIComponent(query.trim())}`;
      const response = await this.makeRequest(searchUrl);
      const $ = cheerio.load(response.data);
      const searchResults = $('.b-content__inline_item');
      const videos: VideoContent[] = [];

      for (let i = 0; i < searchResults.length && this.isRunning; i++) {
        try {
          const item = searchResults.eq(i);
          const link = item.find('.b-content__inline_item-link a').attr('href');

          if (!link) continue;

          const videoPageResponse = await this.makeRequest(link);
          const videoPage = cheerio.load(videoPageResponse.data);
          const videoData = videoPage('#player-wrapper').attr('data-url');

          if (videoData) {
            const extractedVideos = await this.extractVideoUrls(videoData);
            videos.push(...extractedVideos);
          }

          await this.delay(this.minDelay);
        } catch (error) {
          console.error(`Ошибка при обработке результата ${i + 1}:`, error instanceof Error ? error.message : 'Неизвестная ошибка');
          continue;
        }
      }

      return videos;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error(`Ошибка при поиске контента: ${errorMessage}`);
      throw new Error(`Не удалось найти контент: ${errorMessage}`);
    }
  }

  async getTrailer(query: string): Promise<VideoContent | null> {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Поисковый запрос должен быть непустой строкой');
    }

    try {
      const searchUrl = `${this.BASE_URL}/search/?do=search&subaction=search&q=${encodeURIComponent(query.trim())}`;
      const response = await this.makeRequest(searchUrl);
      const $ = cheerio.load(response.data);
      const firstResult = $('.b-content__inline_item').first();
      const link = firstResult.find('.b-content__inline_item-link a').attr('href');

      if (!link) return null;

      const videoPageResponse = await this.makeRequest(link);
      const videoPage = cheerio.load(videoPageResponse.data);
      const trailerData = videoPage('.b-player__trailer').attr('data-url');

      if (!trailerData) return null;

      const trailerVideos = await this.extractVideoUrls(trailerData);
      if (trailerVideos.length === 0) return null;

      const trailer: VideoContent = {
        ...trailerVideos[0],
        type: VideoType.TRAILER
      };

      return trailer;
    } catch (error) {
      console.error('Ошибка при получении трейлера:', error instanceof Error ? error.message : 'Неизвестная ошибка');
      return null;
    }
  }

  async startParsing(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.processQueue();
  }

  async stopParsing(): Promise<void> {
    this.isRunning = false;
  }

  async addToQueue(query: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Поисковый запрос должен быть непустой строкой');
    }

    this.processingQueue.push({ query, metadata });
    if (!this.isRunning) {
      await this.startParsing();
    }
  }

  private async processQueue(): Promise<void> {
    while (this.isRunning && this.processingQueue.length > 0) {
      const item = this.processingQueue.shift();
      if (!item) continue;

      const retryCount = item.retryCount || 0;
      if (retryCount >= this.maxRetries) {
        console.error(`Превышено максимальное количество попыток для запроса: ${item.query}`);
        continue;
      }

      try {
        await this.searchContent(item.query);
        await this.delay(this.calculateDelay(0));
      } catch (error) {
        console.error(`Ошибка при обработке запроса ${item.query}:`, error instanceof Error ? error.message : 'Неизвестная ошибка');
        
        if (retryCount < this.maxRetries) {
          this.processingQueue.push({ ...item, retryCount: retryCount + 1 });
          await this.delay(this.errorDelay);
        }
      }
    }
  }
}
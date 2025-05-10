import { PrismaClient, Media, MediaStatus, VideoType, VideoStatus } from '@prisma/client';
import { YouTubeAPI } from './sources/youtube';

const prisma = new PrismaClient();

export interface VideoContentData {
  url: string;
  quality: string;
  type: VideoType;
  format: string;
  score?: number;
  isRussian?: boolean;
  title?: string;
  description?: string;
  duration?: number;
  size?: number;
}

export interface VideoSource {
  searchContent(query: string): Promise<VideoContentData[]>;
  getTrailer(query: string): Promise<VideoContentData | null>;
}

export interface VideoSourceAPI extends VideoSource {
  getContent(): Promise<VideoContentData[]>;
  getPosters(): Promise<string[]>;
  getBackdrops(): Promise<string[]>;
}

interface TrailerValidationResult {
  isValid: boolean;
  score: number;
  isRussian: boolean;
}

export class ContentParser {
  private readonly youtubeAPI: YouTubeAPI;
  private isRunning: boolean = false;

  constructor() {
    this.youtubeAPI = new YouTubeAPI([
      'AIzaSyB9ikMj4-FUxvabABqhjqUNyJlEGp9N9VY',
      'AIzaSyBH9f3ZiudmMFSO1xLi47oxA1wmWD8lrLs',
      'AIzaSyDsurbDIuDMtPbFwQTSDzvHoQWJYXT8Y7g'
    ]);
  }

  async processMedia(media: Media): Promise<void> {
    if (!media) {
      throw new Error('Медиа не может быть пустым');
    }

    try {
      const content = await this.tryGetContent(media.title);
      if (content.length > 0) {
        await this.saveVideoContent(media.id, content);
        await this.updateMediaStatus(media.id, MediaStatus.READY);
      } else {
        const trailer = await this.getTrailer(media.title, media.title, media.id);
        if (trailer) {
          await this.saveVideoContent(media.id, [trailer]);
          await this.updateMediaStatus(media.id, MediaStatus.TRAILER);
        } else {
          await this.updateMediaStatus(media.id, MediaStatus.NO_VIDEO);
        }
      }
    } catch (error) {
      console.error(`Ошибка обработки медиа ${media.id}:`, error);
      await this.updateMediaStatus(media.id, MediaStatus.ERROR);
      throw error;
    }
  }

  private async tryGetContent(query: string): Promise<VideoContentData[]> {
    if (!query.trim()) {
      throw new Error('Поисковый запрос не может быть пустым');
    }

    try {
      // Возвращаем пустой массив, так как мы используем только YouTube для трейлеров
      return [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Ошибка при получении контента: ${errorMessage}`);
      throw new Error(`Не удалось получить контент: ${errorMessage}`);
    }
  }

  private async getTrailer(query: string, mediaTitle: string, mediaId: number): Promise<VideoContentData | null> {
    if (!query || !mediaTitle || !mediaId) {
      throw new Error('Отсутствуют необходимые параметры для поиска трейлера');
    }

    try {
      // Проверяем существующий трейлер
      const existingTrailer = await prisma.videoContent.findFirst({
        where: {
          type: VideoType.TRAILER,
          media_trailer_id: mediaId
        }
      });

      // Ищем новый трейлер на YouTube
      const youtubeTrailer = await this.youtubeAPI.getTrailer(query);
      
      if (existingTrailer) {
        const existingValidation = await this.validateTrailerUrl(existingTrailer.url, mediaTitle);
        
        // Если существующий трейлер валидный и на русском языке, сохраняем его
        if (existingValidation.isValid && existingValidation.isRussian) {
          console.log(`Сохраняем существующий русский трейлер для ${mediaTitle}`);
          return {
            url: existingTrailer.url,
            quality: existingTrailer.quality,
            type: VideoType.TRAILER,
            format: existingTrailer.format,
            isRussian: existingValidation.isRussian,
            score: existingValidation.score
          };
        }

        // Проверяем новый трейлер, если он существует
        if (youtubeTrailer) {
          // Используем метаданные напрямую из YouTube API
          const isRussian = youtubeTrailer.is_russian || false;
          const score = youtubeTrailer.score || 0;
          
          // Заменяем существующий трейлер только если:
          // 1. Существующий трейлер не валидный или на английском
          // 2. Новый трейлер на русском языке
          if ((!existingValidation.isValid || !existingValidation.isRussian) && isRussian) {
            console.log(`Заменяем ${existingValidation.isValid ? 'английский' : 'невалидный'} трейлер на русский для ${mediaTitle}`);
            return {
              url: youtubeTrailer.url,
              quality: youtubeTrailer.quality,
              type: VideoType.TRAILER,
              format: youtubeTrailer.format,
              isRussian: isRussian,
              score: score,
              title: youtubeTrailer.title || undefined,
              description: youtubeTrailer.description || undefined,
              duration: youtubeTrailer.duration || undefined,
              size: youtubeTrailer.size || undefined
            };
          }
        }
        
        // Возвращаем существующий трейлер, если нет подходящей замены
        return {
          url: existingTrailer.url,
          quality: existingTrailer.quality,
          type: VideoType.TRAILER,
          format: existingTrailer.format,
          isRussian: existingValidation.isRussian,
          score: existingValidation.score
        };
      }

      // Если нет существующего трейлера, возвращаем новый, если он найден
      if (youtubeTrailer) {
        return {
          url: youtubeTrailer.url,
          quality: youtubeTrailer.quality,
          type: VideoType.TRAILER,
          format: youtubeTrailer.format,
          isRussian: youtubeTrailer.is_russian || false,
          score: youtubeTrailer.score || 0,
          title: youtubeTrailer.title || undefined,
          description: youtubeTrailer.description || undefined,
          duration: youtubeTrailer.duration || undefined,
          size: youtubeTrailer.size || undefined
        };
      }

      console.log(`Подходящий трейлер не найден для ${mediaTitle}`);
      return null;
    } catch (error) {
      console.error(`Общая ошибка при получении трейлера для ${mediaTitle}:`, error);
      return null;
    }
  }

  private async validateTrailerUrl(url: string, mediaTitle: string): Promise<TrailerValidationResult> {
    try {
      const urlObj = new URL(url);
      const videoTitle = decodeURIComponent(urlObj.pathname + urlObj.search).toLowerCase();
      const normalizedMediaTitle = mediaTitle.toLowerCase();
      
      // Расширенный список ключевых слов
      const trailerKeywords = ['trailer', 'трейлер', 'тизер', 'teaser'];
      const russianKeywords = ['русский', 'дубляж', 'rus', 'дублированный'];
      
      // Проверяем наличие названия медиа
      const mediaWords = normalizedMediaTitle.split(' ').filter(word => word.length > 2);
      const hasMediaTitle = mediaWords.some(word => videoTitle.includes(word));
      
      // Проверяем ключевые слова
      const hasTrailerKeyword = trailerKeywords.some(keyword => videoTitle.includes(keyword));
      const isRussian = russianKeywords.some(keyword => videoTitle.includes(keyword));
      
      // Упрощенная валидация: достаточно наличия названия медиа и ключевого слова трейлера
      const isValid = hasMediaTitle && hasTrailerKeyword;
      
      // Система оценки без негативных критериев
      let score = 0;
      score += hasMediaTitle ? 40 : 0;
      score += hasTrailerKeyword ? 30 : 0;
      score += isRussian ? 30 : 0;
      
      return { isValid, score, isRussian };

    } catch (error) {
      console.error('Ошибка при валидации URL трейлера:', error);
      return { isValid: false, score: 0, isRussian: false };
    }
  }

  async processContent(title: string): Promise<void> {
    try {
      const media = await prisma.media.findFirst({
        where: { title }
      });

      if (!media) {
        console.error(`Медиа с названием ${title} не найден`);
        return;
      }

      await this.processMedia(media);
    } catch (error) {
      console.error(`Ошибка при обработке контента ${title}:`, error);
      throw error;
    }
  }

  private async saveVideoContent(mediaId: number, content: VideoContentData[]): Promise<void> {
    if (!content || content.length === 0) {
      throw new Error('Отсутствует контент для сохранения');
    }

    try {
      // Удаляем существующие трейлеры для этого медиа перед добавлением новых
      if (content.some(video => video.type === VideoType.TRAILER)) {
        await prisma.videoContent.deleteMany({
          where: {
            media_trailer_id: mediaId,
            type: VideoType.TRAILER
          }
        });
      }

      // Подготавливаем данные для сохранения
      const videoData = content.map(video => {
        // Проверяем и обрабатываем все метаданные
        const title = video.title?.trim() || null;
        const description = video.description?.trim() || null;
        const score = video.score !== undefined ? video.score : 0;
        const isRussian = video.isRussian !== undefined ? video.isRussian : false;
        const duration = video.duration !== undefined ? video.duration : null;
        const size = video.size !== undefined ? video.size : null;

        // Логируем данные перед сохранением для отладки
        console.log('Подготовка данных для сохранения трейлера:', {
          title,
          isRussian,
          score,
          duration
        });

        return {
          url: video.url,
          quality: video.quality,
          type: video.type,
          format: video.format || 'mp4',
          status: VideoStatus.READY,
          score: score,
          is_russian: isRussian,
          media_trailer_id: video.type === VideoType.TRAILER ? mediaId : null,
          media_video_id: video.type === VideoType.FULL_MOVIE || video.type === VideoType.EPISODE ? mediaId : null,
          title: title || undefined,
          description: description || undefined,
          duration: duration || undefined,
          size: size || undefined
        };
      });

      // Сохраняем новые записи
      const result = await prisma.videoContent.createMany({
        data: videoData
      });

      console.log(`Успешно сохранено ${result.count} видео для медиа ${mediaId}`);
      
      // Логируем информацию о сохраненных трейлерах с полными метаданными
      content.forEach(video => {
        if (video.type === VideoType.TRAILER) {
          console.log(`Сохранен трейлер: ${video.title || 'Без названия'}`);
          console.log(`- Русский: ${video.isRussian ? 'Да' : 'Нет'}`);
          console.log(`- Рейтинг: ${video.score || 0}`);
          if (video.duration) console.log(`- Длительность: ${video.duration} сек`);
          if (video.description) console.log(`- Описание: ${video.description}`);
        }
      });

    } catch (error) {
      console.error(`Ошибка сохранения видеоконтента для медиа ${mediaId}:`, error);
      throw new Error(`Не удалось сохранить видеоконтент: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }

  private async updateMediaStatus(mediaId: number, status: MediaStatus): Promise<void> {
    try {
      await prisma.media.update({
        where: { id: mediaId },
        data: { status }
      });
    } catch (error) {
      console.error(`Ошибка обновления статуса для медиа ${mediaId}:`, error);
      throw new Error('Не удалось обновить статус медиа');
    }
  }
}
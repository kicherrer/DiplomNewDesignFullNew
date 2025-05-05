import { PrismaClient, Media, MediaStatus, VideoType, VideoStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface VideoContentData {
  url: string;
  quality: string;
  type: VideoType;
  format: string;
}

import { RezkaParser } from './sources/rezka';
import { YouTubeAPI } from './sources/youtube';

export interface VideoSource {
  searchContent(query: string): Promise<VideoContentData[]>;
  getTrailer(query: string): Promise<VideoContentData | null>;
}

export interface VideoSourceAPI extends VideoSource {
  getContent(): Promise<VideoContentData[]>;
  getPosters(): Promise<string[]>;
  getBackdrops(): Promise<string[]>;
}

export class ContentParser {
  private rezkaParser: RezkaParser;
  private youtubeAPI: YouTubeAPI;
  private isRunning: boolean = false;

  constructor() {
    this.rezkaParser = new RezkaParser();
    this.youtubeAPI = new YouTubeAPI('AIzaSyB9ikMj4-FUxvabABqhjqUNyJlEGp9N9VY');
  }

  private async tryGetContent(query: string): Promise<VideoContentData[]> {
    try {
      const content = await this.rezkaParser.searchContent(query);
      if (content && content.length > 0) {
        return content;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Ошибка при получении контента: ${errorMessage}`);
      throw new Error(`Не удалось получить контент: ${errorMessage}`);
    }
    return [];
  }

  private async getTrailer(query: string): Promise<VideoContentData | null> {
    try {
      // Сначала пробуем получить трейлер с Rezka
      try {
        const rezkaTrailer = await this.rezkaParser.getTrailer(query);
        if (rezkaTrailer && rezkaTrailer.url) {
          console.log('Найден трейлер на Rezka');
          return rezkaTrailer;
        }
      } catch (rezkaError) {
        console.error(`Ошибка при получении трейлера с Rezka: ${rezkaError}`);
        // Продолжаем выполнение, чтобы попробовать YouTube
      }

      // Если на Rezka не нашли или произошла ошибка, пробуем YouTube
      console.log('Поиск трейлера на YouTube...');
      const youtubeTrailer = await this.youtubeAPI.getTrailer(query);
      if (youtubeTrailer && youtubeTrailer.url) {
        console.log('Найден трейлер на YouTube');
        return youtubeTrailer;
      }
    } catch (error) {
      console.error(`Ошибка при получении трейлера: ${error}`);
    }
    console.log('Трейлер не найден');
    return null;
  }

  async processContent(title: string) {
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
      console.error(`Ошибка при обработке контента ${title}: ${error}`);
      throw error;
    }
  }

  async processMedia(media: Media) {
    const searchQuery = `${media.title} ${media.original_title || ''} ${media.release_date?.getFullYear() || ''}`;
    
    try {
      console.log(`Начало обработки медиа: ${media.title}`);
      console.log(`Поисковый запрос: ${searchQuery}`);

      // Проверяем существующий контент на Rezka
      let content: VideoContentData[] = [];
      try {
        content = await this.tryGetContent(searchQuery);
        console.log(`Найдено ${content.length} видео на Rezka`);
      } catch (error) {
        console.error(`Ошибка при поиске контента на Rezka: ${error}`);
        // Продолжаем выполнение, так как мы всё ещё можем попробовать найти трейлер
      }
      
      if (content.length > 0) {
        // Фильтруем и сортируем контент по качеству
        const validContent = content
          .filter(video => video.url && video.quality)
          .sort((a, b) => {
            const qualityOrder: Record<string, number> = { '1080p': 3, '720p': 2, '480p': 1, '360p': 0 };
            const qualityA = qualityOrder[a.quality] ?? -1;
            const qualityB = qualityOrder[b.quality] ?? -1;
            return qualityB - qualityA;
          });

        if (validContent.length > 0) {
          console.log(`Добавление ${validContent.length} видео для ${media.title}`);
          
          // Обновляем существующий контент
          await prisma.media.update({
            where: { id: media.id },
            data: {
              status: MediaStatus.READY,
              videos: {
                create: validContent.map(video => ({
                  url: video.url,
                  quality: video.quality || 'default',
                  type: video.type,
                  format: video.format || 'mp4',
                  status: VideoStatus.READY
                }))
              }
            }
          });
          console.log(`Успешно добавлен контент для ${media.title}`);
          return;
        }
      }

      // Если контент не найден или недействителен, пробуем получить трейлер
      console.log(`Поиск трейлера для ${media.title}`);
      const trailer = await this.getTrailer(searchQuery);
      
      if (trailer && trailer.url) {
        console.log(`Найден трейлер для ${media.title}`);
        try {
          // Проверяем, существует ли уже трейлер с таким URL
          const existingTrailer = await prisma.videoContent.findFirst({
            where: {
              url: trailer.url,
              OR: [
                { media_trailer_id: media.id },
                { media_video_id: media.id }
              ]
            }
          });

          if (!existingTrailer) {
            // Создаем трейлер и обновляем медиа в одной транзакции
            await prisma.$transaction(async (tx) => {
              const createdTrailer = await tx.videoContent.create({
                data: {
                  url: trailer.url,
                  quality: trailer.quality || 'default',
                  type: VideoType.TRAILER,
                  format: trailer.format || 'mp4',
                  status: VideoStatus.READY,
                  media_trailer_id: media.id
                }
              });

              await tx.media.update({
                where: { id: media.id },
                data: {
                  status: MediaStatus.TRAILER
                }
              });

              console.log(`Трейлер успешно сохранен для ${media.title} (ID: ${createdTrailer.id})`);
            });
          } else {
            console.log(`Трейлер уже существует для ${media.title} (ID: ${existingTrailer.id})`);
            // Обновляем статус медиа, если трейлер существует
            await prisma.media.update({
              where: { id: media.id },
              data: {
                status: MediaStatus.TRAILER
              }
            });
          }
        } catch (error) {
          console.error(`Ошибка при сохранении трейлера для ${media.title}: ${error}`);
          throw error;
        }
      } else {
        console.log(`Не найден ни контент, ни трейлер для ${media.title}`);
        await prisma.media.update({
          where: { id: media.id },
          data: {
            status: MediaStatus.NO_VIDEO
          }
        });
      }
    } catch (error) {
      console.error(`Ошибка при обработке медиа ${media.id}: ${error}`);
      await prisma.media.update({
        where: { id: media.id },
        data: {
          status: MediaStatus.ERROR
        }
      });
      throw error;
    }
  }

  async stopParsing() {
    this.isRunning = false;
    await this.rezkaParser.stopParsing();
    console.log('Парсер остановлен');
  }

  async startParsing() {
    if (this.isRunning) {
      console.log('Парсер уже запущен');
      return;
    }

    this.isRunning = true;
    await this.rezkaParser.startParsing();
    try {
      // Создаем запись в истории парсера
      const parserHistory = await prisma.parserHistory.create({
        data: {
          source: 'multiple',
          status: 'running',
          startTime: new Date()
        }
      });

      // Получаем все медиа, требующие обработки
      const mediaToProcess = await prisma.media.findMany({
        where: {
          OR: [
            { status: MediaStatus.INACTIVE },
            { status: MediaStatus.ERROR },
            { status: MediaStatus.NO_VIDEO }
          ]
        },
        include: {
          videos: true,
          trailers: true
        }
      });

      let processedCount = 0;
      const errors: string[] = [];

      for (const media of mediaToProcess) {
        if (!this.isRunning) {
          console.log('Парсинг остановлен пользователем');
          break;
        }
        try {
          console.log(`Обработка медиа: ${media.title}`);
          
          // Проверяем текущее состояние медиа
          const hasValidContent = media.videos.some(v => v.url && v.status === VideoStatus.READY);
          const hasValidTrailer = media.trailers.some(t => t.url && t.status === VideoStatus.READY);

          if (!hasValidContent) {
            console.log(`Поиск контента для: ${media.title}`);
            await this.processMedia(media);
            // Добавляем задержку между обработкой каждого медиа
            await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));
          } else {
            console.log(`Контент уже существует для: ${media.title}`);
          }

          if (!hasValidContent && !hasValidTrailer) {
            console.log(`Поиск трейлера для: ${media.title}`);
            const trailer = await this.getTrailer(media.title);
            if (trailer) {
              await prisma.media.update({
                where: { id: media.id },
                data: {
                  trailers: {
                    create: {
                      url: trailer.url,
                      quality: trailer.quality || 'default',
                      type: VideoType.TRAILER,
                      format: trailer.format || 'mp4',
                      status: VideoStatus.READY
                    }
                  }
                }
              });
              console.log(`Трейлер добавлен для: ${media.title}`);
            }
            // Добавляем задержку после поиска трейлера
            await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
          }

          processedCount++;
          console.log(`Завершена обработка медиа: ${media.title}\n`);
        } catch (error) {
          const errorMessage = `Ошибка обработки медиа ${media.id}: ${error}`;
          console.error(errorMessage);
          errors.push(errorMessage);
          // Добавляем увеличенную задержку после ошибки
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      // Обновляем запись в истории парсера
      const finalStatus = this.isRunning ? 'completed' : 'stopped';
      await prisma.parserHistory.update({
        where: { id: parserHistory.id },
        data: {
          status: finalStatus,
          endTime: new Date(),
          itemsProcessed: processedCount,
          errors: errors
        }
      });

    } catch (error) {
      console.error('Ошибка парсера:', error);
      throw error;
    }
  }
}
import { prisma } from '@/config/database';
import { MediaStatus, Media, MediaType } from '@prisma/client';
import { VideoServices } from './videoServices';

interface VideoSource {
  url: string;
  quality: string;
  type: 'movie' | 'series' | 'trailer';
  source: string;
}

export class VideoProcessor {
  private readonly videoServices: VideoServices;

  constructor() {
    this.videoServices = new VideoServices();
  }

  async processMediaVideo(mediaId: number, sourceId: string): Promise<void> {
    if (!mediaId || !sourceId) {
      throw new Error('Отсутствуют обязательные параметры');
    }

    try {
      const media = await this.getMediaInfo(mediaId);
      await this.processVideoContent(media, sourceId);
    } catch (error) {
      console.error('Ошибка обработки видео:', error);
      await this.updateMediaStatus(mediaId, MediaStatus.ERROR);
      throw error;
    }
  }

  private async getMediaInfo(mediaId: number): Promise<Media> {
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    });

    if (!media) {
      throw new Error(`Медиа с ID ${mediaId} не найдено`);
    }

    return media;
  }

  private async processVideoContent(media: Media, sourceId: string): Promise<void> {
    const isReleased = media.release_date && new Date(media.release_date) <= new Date();

    try {
      if (isReleased) {
        const videoSources = await this.videoServices.getVideoSources(sourceId, media.type.toLowerCase() as 'movie' | 'series');
        if (videoSources.length > 0) {
          await this.saveVideoSources(media.id, videoSources);
          await this.updateMediaStatus(media.id, MediaStatus.READY);
          return;
        }
      }

      const trailer = await this.videoServices.getTrailer(media.title);
      if (trailer) {
        await this.saveVideoSources(media.id, [trailer]);
        await this.updateMediaStatus(media.id, MediaStatus.TRAILER);
      } else {
        await this.updateMediaStatus(media.id, MediaStatus.NO_VIDEO);
      }
    } catch (error) {
      console.error(`Ошибка обработки контента для медиа ${media.id}:`, error);
      await this.updateMediaStatus(media.id, MediaStatus.ERROR);
      throw error;
    }
  }

  private async saveVideoSources(mediaId: number, sources: VideoSource[]): Promise<void> {
    if (!sources || sources.length === 0) {
      throw new Error('Отсутствуют источники видео для сохранения');
    }

    try {
      await prisma.$transaction(async (prisma) => {
        // Удаляем существующие источники
        await prisma.videoSource.deleteMany({
          where: { media_id: mediaId }
        });

        // Добавляем новые источники
        await prisma.videoSource.createMany({
          data: sources.map(source => ({
            media_id: mediaId,
            url: source.url,
            quality: source.quality,
            type: source.type,
            source: source.source
          }))
        });
      });
    } catch (error) {
      console.error(`Ошибка сохранения источников видео для медиа ${mediaId}:`, error);
      throw new Error('Не удалось сохранить источники видео');
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
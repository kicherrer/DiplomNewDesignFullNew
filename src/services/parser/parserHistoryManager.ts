import { prisma } from '@/config/database';
import { Media, MediaType } from '@prisma/client';

interface MediaChange {
  field: string;
  oldValue: any;
  newValue: any;
}

interface MediaHistoryEntry {
  mediaId: number;
  changes: MediaChange[];
  timestamp: Date;
  type: 'update' | 'create';
}

export class ParserHistoryManager {
  private mediaChanges: Map<number, MediaHistoryEntry[]>;

  constructor() {
    this.mediaChanges = new Map();
  }

  async logMediaCreation(media: Media): Promise<void> {
    try {
      await prisma.parserHistory.create({
        data: {
          source: media.source_type || 'unknown',
          status: 'created',
          details: JSON.stringify({
            mediaId: media.id,
            title: media.title,
            type: media.type,
            source: media.source_type
          }),
          startTime: new Date(),
          endTime: new Date(),
          itemsProcessed: 1,
          errors: []
        }
      });
    } catch (error) {
      console.error('Error logging media creation:', error);
    }
  }

  async logMediaUpdate(mediaId: number, changes: MediaChange[]): Promise<void> {
    try {
      const media = await prisma.media.findUnique({
        where: { id: mediaId }
      });

      if (!media) return;

      await prisma.parserHistory.create({
        data: {
          source: media.source_type || 'unknown',
          status: 'updated',
          details: JSON.stringify({
            mediaId: media.id,
            title: media.title,
            changes: changes
          }),
          startTime: new Date(),
          endTime: new Date(),
          itemsProcessed: 1,
          errors: []
        }
      });
    } catch (error) {
      console.error('Error logging media update:', error);
    }
  }

  async getMediaHistory(mediaId: number): Promise<MediaHistoryEntry[]> {
    try {
      const history = await prisma.parserHistory.findMany({
        where: {
          details: {
            contains: String(mediaId)
          }
        },
        orderBy: {
          startTime: 'desc'
        }
      });

      return history.map(entry => {
        const details = JSON.parse(entry.details || '{}');
        return {
          mediaId: details.mediaId,
          changes: details.changes || [],
          timestamp: entry.startTime,
          type: entry.status === 'created' ? 'create' : 'update'
        };
      });
    } catch (error) {
      console.error('Error getting media history:', error);
      return [];
    }
  }

  async compareAndLogChanges(oldMedia: Media, newMedia: Partial<Media>): Promise<void> {
    const changes: MediaChange[] = [];

    // Сравниваем все поля и записываем изменения
    Object.entries(newMedia).forEach(([key, value]) => {
      if (oldMedia[key as keyof Media] !== value) {
        changes.push({
          field: key,
          oldValue: oldMedia[key as keyof Media],
          newValue: value
        });
      }
    });

    if (changes.length > 0) {
      await this.logMediaUpdate(oldMedia.id, changes);
    }
  }

  async getAvailablePosters(mediaId: number): Promise<string[]> {
    try {
      const media = await prisma.media.findUnique({
        where: { id: mediaId }
      });

      if (!media) return [];

      const posters: string[] = [];
      if (media.poster_url) posters.push(media.poster_url);

      // Получаем историю изменений постеров
      const history = await this.getMediaHistory(mediaId);
      history.forEach(entry => {
        entry.changes.forEach(change => {
          if (change.field === 'poster_url' && change.oldValue) {
            posters.push(change.oldValue);
          }
        });
      });

      return [...new Set(posters)]; // Удаляем дубликаты
    } catch (error) {
      console.error('Error getting available posters:', error);
      return [];
    }
  }

  async getAvailableBackdrops(mediaId: number): Promise<string[]> {
    try {
      const media = await prisma.media.findUnique({
        where: { id: mediaId }
      });

      if (!media) return [];

      const backdrops: string[] = [];
      if (media.backdrop_url) backdrops.push(media.backdrop_url);

      // Получаем историю изменений задников
      const history = await this.getMediaHistory(mediaId);
      history.forEach(entry => {
        entry.changes.forEach(change => {
          if (change.field === 'backdrop_url' && change.oldValue) {
            backdrops.push(change.oldValue);
          }
        });
      });

      return [...new Set(backdrops)]; // Удаляем дубликаты
    } catch (error) {
      console.error('Error getting available backdrops:', error);
      return [];
    }
  }
}
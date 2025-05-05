import { MediaApi, KinopoiskMovie } from './mediaApi';
import { prisma } from '@/config/database';
import { Prisma, MediaType, MediaStatus, ParserStatusType } from '@prisma/client';
import { VideoProcessor } from './videoProcessor';



interface SeriesEpisode {
  episodeNumber: number;
  nameRu: string | null;
  nameEn: string | null;
  synopsis: string | null;
  releaseDate: string | null;
}

interface SeriesSeason {
  seasonNumber: number;
  number: number;
  episodes: SeriesEpisode[];
}

export class MediaParser {
  private mediaApi: MediaApi;
  private isRunning: boolean = false;

  private videoProcessor: VideoProcessor;

  constructor() {
    const KINOPOISK_API_KEY = '722c1497-106b-4bf7-951e-3e9b0bd8bb6e';
    const OMDB_API_KEY = '159d3d51';
    this.mediaApi = new MediaApi(KINOPOISK_API_KEY, OMDB_API_KEY);
    this.videoProcessor = new VideoProcessor();
  }

  async start() {
    if (this.isRunning) {
      throw new Error('Парсер уже запущен');
    }

    this.isRunning = true;
    await this.updateParserStatus('active');

    try {
      await this.processNewContent();
      await this.updateExistingContent();
    } catch (error) {
      console.error('Parser error:', error);
      await this.updateParserStatus('error', [(error as Error).message]);
    await this.logError('Ошибка парсера', error);
      this.isRunning = false;
      throw error;
    }

    this.isRunning = false;
    await this.updateParserStatus('inactive');
  }

  async stop() {
    this.isRunning = false;
    await this.updateParserStatus('inactive');
  }

  private async processNewContent() {
    try {
      const currentStatus = await prisma.parserStatus.findFirst();
      if (!currentStatus || currentStatus.status !== 'active') {
        throw new Error('Парсер не активен');
      }

      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      // Получаем фильмы за текущий и прошлый год
      const [currentYearMovies, lastYearMovies] = await Promise.all([
        this.mediaApi.searchKinopoisk(String(currentYear)),
        this.mediaApi.searchKinopoisk(String(lastYear))
      ]);

      const movies = [...(currentYearMovies || []), ...(lastYearMovies || [])];
      
      if (!movies.length) {
        console.log('No movies found for the specified years');
        return;
      }

      let processedCount = 0;
      const batchSize = 10;
      const movieBatches = [];

      // Группируем фильмы по батчам для оптимизации запросов
      for (let i = 0; i < movies.length; i += batchSize) {
        movieBatches.push(movies.slice(i, i + batchSize));
      }

      for (const batch of movieBatches) {
        if (!this.isRunning) break;

        try {
          // Проверяем существующие медиа в батче
          const existingMedia = await prisma.media.findMany({
            where: {
              OR: batch.map(movie => ({
                AND: [
                  { source_id: String(movie.filmId) },
                  { source_type: 'kinopoisk' }
                ]
              }))
            }
          });

          const existingIds = new Set(existingMedia.map(media => media.source_id));

          for (const movie of batch) {
            if (!this.isRunning) break;
            if (existingIds.has(String(movie.filmId))) continue;

            try {
              const details = await this.mediaApi.getKinopoiskDetails(Number(movie.filmId));
              if (!details) {
                console.log(`Не найдены детали для фильма ${movie.filmId}`);
                continue;
              }

              const mediaType = details.type === 'FILM' ? MediaType.MOVIE : MediaType.SERIES;
              const releaseDate = details.year ? new Date(details.year, 0) : null;

              // Создаем запись о медиаконтенте
              let posterUrl = details.posterUrl;
              let backdropUrl = details.coverUrl;

              // Если постер отсутствует, пробуем найти через OMDB
              if (!posterUrl && details.imdbId) {
                try {
                  const omdbDetails = await this.mediaApi.getOmdbDetails(details.imdbId);
                  if (omdbDetails.Poster && omdbDetails.Poster !== 'N/A') {
                    posterUrl = omdbDetails.Poster;
                  }
                } catch (omdbError) {
                  console.error(`Ошибка получения постера из OMDB для ${details.imdbId}:`, omdbError);
                }
              }

              const mediaData: Prisma.MediaCreateInput = {
                title: details.nameRu || details.nameOriginal || String(movie.filmId),
                original_title: details.nameOriginal,
                type: mediaType,
                description: details.description || '',
                poster_url: posterUrl || null,
                backdrop_url: backdropUrl || null,
                release_date: releaseDate,
                rating: details.ratingKinopoisk || 0,
                duration: details.filmLength || null,
                status: MediaStatus.ACTIVE,
                source_id: String(movie.filmId),
                source_type: 'kinopoisk',
                genres: details.genres?.length ? {
                  connectOrCreate: details.genres.map(g => ({
                    where: { name: g.genre },
                    create: { name: g.genre }
                  }))
                } : undefined
              };

              const createdMedia = await prisma.media.create({
                data: mediaData
              });

              // Обработка видео или трейлера
              await this.videoProcessor.processMediaVideo(createdMedia.id, String(movie.filmId));

              // Если это сериал, получаем информацию о сериях
              if (mediaType === 'SERIES') {
                try {
                  const episodes = await this.mediaApi.getSeriesEpisodes(Number(movie.filmId));
                  if (episodes && Array.isArray(episodes)) {
                    for (const season of episodes) {
                      if (!season.episodes) continue;
                      for (const episode of season.episodes) {
                        try {
                          await prisma.episode.create({
                            data: {
                              title: episode.nameRu || episode.nameEn || `Серия ${episode.episodeNumber}`,
                              episode_number: episode.episodeNumber,
                              season_number: season.number,
                              air_date: episode.releaseDate ? new Date(episode.releaseDate) : null,
                              description: episode.synopsis || null,
                              media_id: createdMedia.id
                            }
                          });
                        } catch (episodeCreateError) {
                          console.error(`Error creating episode for media ${movie.filmId}:`, episodeCreateError);
                          await this.logError(`Ошибка создания эпизода для медиа ${movie.filmId}`, episodeCreateError);
                        }
                      }
                    }
                  }
                } catch (episodeError) {
                  console.error(`Error processing episodes for media ${movie.filmId}:`, episodeError);
                  await this.updateParserStatus('error', [`Ошибка обработки эпизодов: ${(episodeError as Error).message}`]);
                  await this.logError(`Ошибка обработки эпизодов для медиа ${movie.filmId}`, episodeError);
                }
              }

              processedCount++;
              await this.updateProcessedItems(processedCount);
              await this.updateParserStatus('active', []);
              
              // Добавляем задержку между запросами для избежания блокировки API
              const delay = processedCount % 10 === 0 ? 2000 : 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
            } catch (movieError) {
              console.error(`Error processing movie ${movie.filmId}:`, movieError);
              const errorMessage = movieError instanceof Error ? movieError.message : 'Неизвестная ошибка';
              await this.updateParserStatus('error', [`Ошибка обработки фильма: ${errorMessage}`]);
              await this.logError(`Ошибка обработки фильма ${movie.filmId}`, movieError);
              continue;
            }
          }
        } catch (batchError) {
          console.error('Error processing batch:', batchError);
          await this.updateParserStatus('error', [`Ошибка обработки пакета: ${(batchError as Error).message}`]);
          await this.logError('Ошибка обработки пакета', batchError);
          continue;
        }
      }
    } catch (error) {
      console.error('Parser error:', error);
      await this.updateParserStatus('error', [`Общая ошибка парсера: ${(error as Error).message}`]);
      await this.logError('Общая ошибка парсера', error);
      this.isRunning = false;
      throw error;
    }
  }

  private async updateExistingContent() {
    try {
      const currentStatus = await prisma.parserStatus.findFirst();
      if (currentStatus?.status !== 'active') {
        throw new Error('Парсер не активен');
      }

      const batchSize = 20;
      let processedCount = 0;
      let hasMore = true;

      while (hasMore && this.isRunning) {
        const existingMedia = await prisma.media.findMany({
          where: {
            type: MediaType.SERIES,
            status: MediaStatus.ACTIVE,
            updated_at: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          },
          orderBy: {
            updated_at: 'asc'
          },
          take: batchSize,
          skip: processedCount
        });

        if (!existingMedia.length) {
          hasMore = false;
          break;
        }

        for (const media of existingMedia) {
          if (!this.isRunning) break;

          try {
            if (media.source_type === 'kinopoisk' && media.source_id) {
              const episodes = await this.mediaApi.getSeriesEpisodes(parseInt(media.source_id));
              if (!episodes || !Array.isArray(episodes)) continue;

              for (const season of episodes) {
                if (!season.episodes || !season.number) continue;
                for (const episode of season.episodes) {
                  try {
                    await prisma.episode.upsert({
                      where: {
                        media_id_season_number_episode_number: {
                          media_id: media.id,
                          season_number: season.number,
                          episode_number: episode.episodeNumber
                        }
                      },
                      create: {
                        title: episode.nameRu || episode.nameEn || `Серия ${episode.episodeNumber}`,
                        episode_number: episode.episodeNumber,
                        season_number: season.number,
                        air_date: episode.releaseDate ? new Date(episode.releaseDate) : null,
                        description: episode.synopsis || null,
                        media_id: media.id
                      },
                      update: {
                        title: episode.nameRu || episode.nameEn || `Серия ${episode.episodeNumber}`,
                        air_date: episode.releaseDate ? new Date(episode.releaseDate) : null,
                        description: episode.synopsis || null
                      }
                    });
                  } catch (episodeError) {
                    console.error(`Error updating episode for media ${media.id}:`, episodeError);
                    await this.logError(`Ошибка обновления эпизода для медиа ${media.id}`, episodeError);
                  }
                }
              }
              await this.updateParserStatus('active', []);
            }
          } catch (error) {
            console.error(`Error updating media ${media.id}:`, error);
            await this.updateParserStatus('error', [`Ошибка обновления сериала: ${(error as Error).message}`]);
            continue;
          }
        }

        processedCount += existingMedia.length;
        await this.updateProcessedItems(processedCount);
      }
    } catch (error) {
      console.error('Error updating existing content:', error);
      await this.updateParserStatus('error', [`Ошибка обновления контента: ${(error as Error).message}`]);
      throw error;
    }
  }

  private async updateParserStatus(status: ParserStatusType, errors: string[] = []): Promise<void> {
    try {
      const existingStatus = await prisma.parserStatus.findFirst();
      if (existingStatus) {
        await prisma.parserStatus.update({
          where: { id: existingStatus.id },
          data: {
            status,
            lastRun: new Date(),
            errors
          }
        });
      } else {
        await prisma.parserStatus.create({
          data: {
            status,
            errors,
            processedItems: 0
          }
        });
      }
    } catch (error) {
      console.error('Error updating parser status:', error);
      await this.logError('Ошибка обновления статуса парсера', error);
    }
  }

  private async updateProcessedItems(count: number): Promise<void> {
    try {
      await prisma.parserStatus.update({
        where: { id: 1 },
        data: {
          processedItems: count
        }
      });
    } catch (error) {
      console.error('Error updating processed items:', error);
      await this.logError('Ошибка обновления счетчика обработанных элементов', error);
    }
  }

  private async logError(message: string, error: unknown): Promise<void> {
    try {
      await prisma.parserLog.create({
        data: {
          message,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        }
      });
    } catch (logError) {
      console.error('Error logging to database:', logError);
    }
  }
}
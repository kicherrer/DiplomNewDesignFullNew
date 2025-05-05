import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Media as PrismaMedia, Genre, Episode, ViewingHistory, Favorites, Watchlist } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

type MediaResponse = Omit<PrismaMedia, 'genres'> & {
  genres: string[];
  episodes: Episode[];
  is_in_favorites: boolean;
  is_in_watchlist: boolean;
  watch_progress: number;
  last_watched: Date | null;
  videos: {
    url: string;
    quality: string;
    type: string;
    format: string;
  }[];
  trailers: {
    url: string;
    quality: string;
    type: string;
    format: string;
  }[];
}

type MediaWithIncludes = PrismaMedia & {
  genres: Genre[];
  episodes: Episode[];
  viewing_history: ViewingHistory[];
  favorites: Favorites[];
  watchlist: Watchlist[];
}



const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MediaResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const decoded = await verifyToken(token);
    if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
    const userId = decoded.userId;

    const { id } = req.query;
    const movieId = parseInt(id as string);

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'Неверный ID медиа контента' });
    }

    const movie = await prisma.media.findUnique({
      where: { id: movieId },
      include: {
        genres: true,
        episodes: {
          orderBy: [
            { season_number: 'asc' },
            { episode_number: 'asc' }
          ]
        },
        viewing_history: {
          where: { user_id: Number(userId) },
          orderBy: { created_at: 'desc' },
          take: 1
        },
        favorites: {
          where: { user_id: Number(userId) },
          take: 1
        },
        watchlist: {
          where: { user_id: Number(userId) },
          take: 1
        },
        videos: {
          where: { status: 'READY' }
        },
        trailers: {
          where: { status: 'READY' }
        }
      }
    });

    if (!movie) {
      return res.status(404).json({ error: 'Медиа контент не найден' });
    }

    // Форматируем данные для фронтенда
    const formattedMovie = {
      ...movie,
      genres: (movie as MediaWithIncludes).genres.map((g: Genre) => g.name),
      episodes: (movie as MediaWithIncludes).episodes,
      is_in_favorites: (movie as MediaWithIncludes).favorites.length > 0,
      is_in_watchlist: (movie as MediaWithIncludes).watchlist.length > 0,
      watch_progress: (movie as MediaWithIncludes).viewing_history[0]?.watch_duration || 0,
      last_watched: (movie as MediaWithIncludes).viewing_history[0]?.created_at || null,
      videos: movie.videos.map(video => ({
        url: video.url,
        quality: video.quality,
        type: video.type,
        format: video.format
      })),
      trailers: movie.trailers.map(trailer => ({
        url: trailer.url,
        quality: trailer.quality,
        type: trailer.type,
        format: trailer.format
      }))
    } satisfies MediaResponse;

    res.status(200).json(formattedMovie);
  } catch (error) {
    console.error('Error fetching movie:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    await prisma.$disconnect();
  }
}
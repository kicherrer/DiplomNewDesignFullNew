import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Проверка авторизации
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const decoded = await verifyToken(token) as { userId: number };
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { id } = req.query;
    const mediaId = parseInt(id as string);

    if (isNaN(mediaId)) {
      return res.status(400).json({ error: 'Некорректный ID' });
    }

    switch (req.method) {
      case 'GET':
        const mediaItem = await prisma.media.findUnique({
          where: { id: mediaId },
          include: {
            genres: true,
            videos: true,
            trailers: true
          }
        });

        if (!mediaItem) {
          return res.status(404).json({ error: 'Контент не найден' });
        }

        return res.status(200).json(mediaItem);

      case 'PUT':
        const updatedData = req.body;
        
        // Отделяем связанные данные от основных данных
        const { genres, videos, trailers, id: _, media_files, ...mediaData } = updatedData;

        const updatedMediaItem = await prisma.media.update({
          where: { id: mediaId },
          data: {
            ...mediaData,
            // Обновляем связи с жанрами
            genres: genres ? {
              deleteMany: {},
              create: genres.map((genre: { id: number; name: string }) => ({
                genre_id: genre.id
              }))
            } : undefined,
            // Обновляем видео
            videos: videos ? {
              deleteMany: {},
              create: videos.map((video: any) => ({
                ...video,
                media_video_id: mediaId
              }))
            } : undefined,
            // Обновляем трейлеры
            trailers: trailers ? {
              deleteMany: {},
              create: trailers.map((trailer: any) => ({
                ...trailer,
                media_trailer_id: mediaId
              }))
            } : undefined
          },
          include: {
            genres: true,
            videos: true,
            trailers: true
          }
        });

        return res.status(200).json(updatedMediaItem);

      case 'DELETE':
        try {
          // Удаление связанных данных
          await prisma.$transaction([
            // Удаление связанных эпизодов (для сериалов)
            prisma.episode.deleteMany({
              where: { media_id: mediaId }
            }),
            // Удаление из истории просмотров
            prisma.viewingHistory.deleteMany({
              where: { media_id: mediaId }
            }),
            // Удаление из избранного
            prisma.favorites.deleteMany({
              where: { media_id: mediaId }
            }),
            // Удаление из списка просмотра
            prisma.watchlist.deleteMany({
              where: { media_id: mediaId }
            }),
            // Удаление источников видео
            prisma.videoSource.deleteMany({
              where: { media_id: mediaId }
            }),
            // Удаление самого медиа-контента
            prisma.media.delete({
              where: { id: mediaId }
            })
          ]);

          // Очищаем кэш статистики в sessionStorage
          await prisma.$transaction([
            prisma.media.delete({
              where: { id: mediaId }
            }),
            prisma.$executeRaw`DELETE FROM "session" WHERE data LIKE '%adminDashboardStats%'`
          ]);
          
          return res.status(200).json({ message: 'Медиа-контент успешно удален', needStatsUpdate: true });
        } catch (deleteError) {
          console.error('Error deleting media:', deleteError);
          return res.status(500).json({ error: 'Ошибка при удалении медиа-контента' });
        }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
  } catch (error) {
    console.error('Error in content [id] handler:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
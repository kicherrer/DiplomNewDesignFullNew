import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
  }

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

    // Получаем информацию о таблицах из Prisma schema
    const tables = [
      { name: 'user', rowCount: await prisma.user.count() },
      { name: 'media', rowCount: await prisma.media.count() },
      { name: 'episode', rowCount: await prisma.episode.count() },
      { name: 'genre', rowCount: await prisma.genre.count() },
      { name: 'videoContent', rowCount: await prisma.videoContent.count() },
      { name: 'favorites', rowCount: await prisma.favorites.count() },
      { name: 'watchlist', rowCount: await prisma.watchlist.count() },
      { name: 'viewingHistory', rowCount: await prisma.viewingHistory.count() },
      { name: 'parserHistory', rowCount: await prisma.parserHistory.count() },
      { name: 'parserStatus', rowCount: await prisma.parserStatus.count() }
    ];

    return res.status(200).json(tables);
  } catch (error) {
    console.error('Error in database tables handler:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
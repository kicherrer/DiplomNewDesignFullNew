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
        const updatedMediaItem = await prisma.media.update({
          where: { id: mediaId },
          data: updatedData,
        });

        return res.status(200).json(updatedMediaItem);

      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
  } catch (error) {
    console.error('Error in content [id] handler:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
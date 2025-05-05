import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { verifyToken } from '@/utils/auth';

type DecodedToken = {
  userId: number;
  role?: 'USER' | 'ADMIN';
};

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Проверка авторизации
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const decoded = await verifyToken(token) as DecodedToken;
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

    switch (req.method) {
      case 'GET':
        const { page = '1', limit = '10', search } = req.query;
        const pageNumber = parseInt(page as string);
        const limitNumber = parseInt(limit as string);
        const skip = (pageNumber - 1) * limitNumber;

        const where: Prisma.MediaWhereInput = {};
        if (search && typeof search === 'string') {
          where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { original_title: { contains: search, mode: 'insensitive' } }
          ];
        }

        const [mediaItems, totalCount] = await Promise.all([
          prisma.media.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip,
            take: limitNumber,
            include: {
              genres: true,
              episodes: {
                orderBy: [
                  { season_number: 'asc' },
                  { episode_number: 'asc' }
                ]
              }
            }
          }),
          prisma.media.count({ where })
        ]);

        return res.status(200).json({
          items: mediaItems,
          total: totalCount,
          page: pageNumber,
          totalPages: Math.ceil(totalCount / limitNumber)
        });

      case 'DELETE':
        const { id } = req.query;
        if (!id || Array.isArray(id) || isNaN(parseInt(id))) {
          return res.status(400).json({ error: 'Неверный ID' });
        }

        const mediaId = parseInt(id);
        const existingMedia = await prisma.media.findUnique({
          where: { id: mediaId }
        });

        if (!existingMedia) {
          return res.status(404).json({ error: 'Контент не найден' });
        }

        try {
          await prisma.media.delete({
            where: { id: mediaId },
          });
          return res.status(200).json({ message: 'Контент успешно удален' });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              return res.status(404).json({ error: 'Контент не найден' });
            }
          }
          console.error('Delete error:', error);
          return res.status(500).json({ error: 'Ошибка при удалении контента' });
        }

      default:
        res.setHeader('Allow', ['GET', 'DELETE']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    await prisma.$disconnect();
  }
}
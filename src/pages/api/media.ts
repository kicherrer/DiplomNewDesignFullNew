import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma, MediaStatus } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const { page = '1', limit = '12', status } = req.query;
    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const where: Prisma.MediaWhereInput = {};
    
    // Фильтрация по статусу, если указан
    if (status && typeof status === 'string') {
      where.status = status as MediaStatus;
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
  } catch (error) {
    console.error('Media API Error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    await prisma.$disconnect();
  }
}
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { verifyToken } from '@/utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const userId = await verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    const { page = '1', limit = '40', genre, year, rating, sort } = req.query;
    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const where: Prisma.MediaWhereInput = {
      type: 'MOVIE',
      status: 'ACTIVE'
    };

    if (genre && typeof genre === 'string') {
      where.genres = {
        some: {
          name: genre
        }
      };
    }

    if (year && typeof year === 'string') {
      where.release_date = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`)
      };
    }

    if (rating && typeof rating === 'string') {
      where.rating = {
        gte: parseFloat(rating)
      };
    }

    let orderBy: Prisma.MediaOrderByWithRelationInput = { created_at: 'desc' };
    if (sort === 'rating') {
      orderBy = { rating: 'desc' };
    } else if (sort === 'year') {
      orderBy = { release_date: 'desc' };
    }

    const [movies, totalCount] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy,
        skip,
        take: limitNumber,
        include: {
          genres: true
        }
      }),
      prisma.media.count({ where })
    ]);

    return res.status(200).json({
      items: movies,
      total: totalCount,
      page: pageNumber,
      totalPages: Math.ceil(totalCount / limitNumber)
    });

  } catch (error) {
    console.error('Movies API Error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    await prisma.$disconnect();
  }
}
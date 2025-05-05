import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { verifyToken } from '@/utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { filters = { genre: [], year: '', rating: '', sort: 'date' }, page = 1, limit = 100 } = req.body;
    const skip = (page - 1) * limit;

    const where = {
      status: 'ACTIVE',
      ...(filters.genre?.length > 0 && {
        genres: {
          some: {
            name: {
              in: filters.genre
            }
          }
        }
      }),
      ...(filters.year && {
        release_date: {
          gte: new Date(filters.year, 0, 1),
          lt: new Date(parseInt(filters.year) + 1, 0, 1)
        }
      }),
      ...(filters.rating && {
        rating: {
          gte: parseFloat(filters.rating)
        }
      })
    };

    const [items, total] = await Promise.all([
      prisma.media.findMany({
        where,
        skip,
        take: limit,
        // Оптимизация выборки полей
        include: {
          genres: true
        },
        orderBy: [
          { created_at: 'desc' },
          ...(filters.sort === 'popularity' ? [{ views: Prisma.SortOrder.desc }] : []),
          ...(filters.sort === 'rating' ? [{ rating: Prisma.SortOrder.desc }] : []),
          ...(filters.sort === 'date' ? [{ release_date: Prisma.SortOrder.desc }] : [])
        ]
      }),
      prisma.media.count({ where })
    ]);

    return res.status(200).json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
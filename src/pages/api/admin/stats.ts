import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/utils/auth';
import prisma from '@/config/database';

let statsCache: any = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут в миллисекундах

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const payload = await verifyToken(token);
    if (!payload || typeof payload.userId !== 'number') {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const currentTime = Date.now();
    if (statsCache && (currentTime - lastCacheTime) < CACHE_DURATION) {
      return res.json(statsCache);
    }

    const [totalContent, activeUsers, parserStatus] = await Promise.all([
      prisma.media.count(),
      prisma.user.count({
        where: {
          updated_at: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Активные за последние 30 дней
          }
        }
      }),
      prisma.parserStatus.findFirst({
        select: { status: true }
      })
    ]);

    const stats = {
      totalContent,
      activeUsers,
      parserStatus: parserStatus?.status || 'inactive'
    };

    statsCache = stats;
    lastCacheTime = currentTime;

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json(stats);
  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({ error: 'Ошибка при получении статистики' });
  }
}
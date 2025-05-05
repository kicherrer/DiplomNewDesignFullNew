import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

interface JwtPayload {
  userId: number;
  role: string;
  iat?: number;
  exp?: number;
}

const REFRESH_COOLDOWN = 10000; // 10 секунд
const refreshAttempts = new Map<number, number>();

async function getUserAndGenerateToken(userId: number, secretKey: string) {
  // Проверяем время последнего обновления токена
  const lastRefresh = refreshAttempts.get(userId);
  const now = Date.now();
  
  if (lastRefresh && (now - lastRefresh) < REFRESH_COOLDOWN) {
    return null; // Слишком частые попытки обновления
  }
  
  refreshAttempts.set(userId, now);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      is_verified: true
    }
  });

  if (!user || !user.is_verified) {
    return null;
  }

  const newToken = jwt.sign(
    { userId: user.id, role: user.role },
    secretKey,
    { expiresIn: '24h' }
  );

  return { token: newToken, role: user.role };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Отсутствует токен авторизации' });
    }

    const oldToken = authHeader.split(' ')[1];
    const secretKey = process.env.JWT_SECRET;

    if (!secretKey) {
      console.error('JWT_SECRET не настроен');
      return res.status(500).json({ error: 'Ошибка конфигурации сервера' });
    }

    let userId: number;

    try {
      const decoded = jwt.verify(oldToken, secretKey) as JwtPayload;
      userId = decoded.userId;
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        const decoded = jwt.decode(oldToken) as JwtPayload;
        if (!decoded?.userId) {
          return res.status(401).json({ error: 'Недействительный токен' });
        }
        userId = decoded.userId;
      } else {
        return res.status(401).json({ error: 'Недействительный токен' });
      }
    }

    const result = await getUserAndGenerateToken(userId, secretKey);
    if (!result) {
      // Проверяем, не связан ли отказ с частыми попытками
      const lastRefresh = refreshAttempts.get(userId);
      const now = Date.now();
      
      if (lastRefresh && (now - lastRefresh) < REFRESH_COOLDOWN) {
        return res.status(429).json({ error: 'Слишком много попыток обновления токена. Пожалуйста, подождите.' });
      }
      
      return res.status(401).json({ error: 'Пользователь не найден или не верифицирован' });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Ошибка при обновлении токена:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
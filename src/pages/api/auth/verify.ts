import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../config/database';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../../config/constants';

interface JwtPayload {
  userId: number;
  role: string;
  iat: number;
  exp: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Обрабатываем только GET запросы для проверки токена
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  // Проверяем наличие заголовка авторизации
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      isValid: false,
      error: 'Токен не предоставлен' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Проверяем валидность JWT токена
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Базовая проверка существования пользователя
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({ 
        isValid: false,
        error: 'Пользователь не найден' 
      });
    }

    // Токен валиден, возвращаем успешный ответ
    return res.status(200).json({
      isValid: true,
      userId: user.id,
      role: user.role
    });

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        isValid: false,
        error: 'Срок действия токена истек' 
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        isValid: false,
        error: 'Недействительный токен' 
      });
    }

    console.error('Ошибка при проверке токена:', error);
    return res.status(500).json({ 
      isValid: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
}
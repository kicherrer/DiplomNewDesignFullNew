import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../config/database';
import { verifyToken } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Проверяем токен
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];
  const payload = await verifyToken(token);

  if (!payload || typeof payload.userId !== 'number') {
    return res.status(401).json({ error: 'Недействительный токен' });
  }

  if (req.method === 'GET') {
    try {
      // Получаем данные пользователя и его настройки
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          settings: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const profile = {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        role: user.role,
        notification_email: user.settings?.notification_email,
        notification_web: user.settings?.notification_web,
        privacy_profile: user.settings?.privacy_profile,
        theme: user.settings?.theme,
        language: user.settings?.language,
        views_count: user.views_count,
        favorites_count: user.favorites_count,
        watchlist_count: user.watchlist_count
      };

      res.status(200).json(profile);
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Ошибка при получении профиля' });
    }
  } else if (req.method === 'PUT') {
    const { username, settings } = req.body;

    try {
      // Обновляем основные данные пользователя и настройки
      await prisma.$transaction(async (prisma) => {
        if (username) {
          await prisma.user.update({
            where: { id: payload.userId },
            data: { username }
          });
        }

        if (settings) {
          await prisma.userSettings.upsert({
            where: { user_id: payload.userId },
            create: {
              user_id: payload.userId,
              notification_email: settings.notification_email,
              notification_web: settings.notification_web,
              privacy_profile: settings.privacy_profile,
              theme: settings.theme,
              language: settings.language
            },
            update: {
              notification_email: settings.notification_email,
              notification_web: settings.notification_web,
              privacy_profile: settings.privacy_profile,
              theme: settings.theme,
              language: settings.language
            }
          });
        }
      });

      res.status(200).json({ message: 'Профиль обновлен' });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Ошибка при обновлении профиля' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
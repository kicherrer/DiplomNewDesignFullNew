import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { verifyToken } from '../../../utils/auth';

type ProfileInfo = {
  bio?: string;
  location?: string;
  website?: string;
  social?: Prisma.InputJsonValue;
};

type MediaId = {
  mediaId: number;
};

type Duration = {
  duration: number;
} & MediaId;

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { param } = req.query;
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  try {
    const payload = await verifyToken(token);
    if (!payload || typeof payload.userId !== 'number') {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
    const userId = payload.userId;

    // Если param является числом, обрабатываем как запрос профиля по ID
    if (!isNaN(Number(param))) {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
      }
      const profileId = parseInt(param as string);
      const user = await prisma.user.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          email: true,
          nickname: true,
          role: true,
          is_verified: true,
          created_at: true,
          avatar_url: true
        }
      });
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      return res.status(200).json(user);
    }

    // Обработка других параметров профиля
    switch (param) {
      case 'watchlist':
        return handleWatchlist(req, res, userId);
      case 'favorites':
        return handleFavorites(req, res, userId);
      case 'history':
        return handleHistory(req, res, userId);
      case 'avatar':
        return handleAvatar(req, res, userId);
      case 'info':
        return handleProfileInfo(req, res, userId);
      default:
        return res.status(404).json({ error: 'Метод не найден' });
    }
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

async function handleWatchlist(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    switch (req.method) {
      case 'GET':
        const watchlist = await prisma.watchlist.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          include: { media: true }
        });
        return res.status(200).json(watchlist);

      case 'POST':
        const { mediaId } = req.body as MediaId;
        await prisma.watchlist.create({
          data: {
            user_id: userId,
            media_id: mediaId
          }
        });
        return res.status(200).json({ message: 'Добавлено в список' });

      case 'DELETE':
        const { id } = req.body;
        await prisma.watchlist.deleteMany({
          where: {
            user_id: userId,
            media_id: id
          }
        });
        return res.status(200).json({ message: 'Удалено из списка' });

      default:
        return res.status(405).json({ error: 'Метод не разрешен' });
    }
  } catch (error) {
    console.error('Watchlist error:', error);
    return res.status(500).json({ error: 'Ошибка при работе со списком просмотра' });
  }
}

async function handleFavorites(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    switch (req.method) {
      case 'GET':
        const favorites = await prisma.favorites.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          include: { media: true }
        });
        return res.status(200).json(favorites);

      case 'POST':
        const { mediaId } = req.body as MediaId;
        await prisma.favorites.create({
          data: {
            user_id: userId,
            media_id: mediaId
          }
        });
        return res.status(200).json({ message: 'Добавлено в избранное' });

      case 'DELETE':
        const { id } = req.body;
        await prisma.favorites.deleteMany({
          where: {
            user_id: userId,
            media_id: id
          }
        });
        return res.status(200).json({ message: 'Удалено из избранного' });

      default:
        return res.status(405).json({ error: 'Метод не разрешен' });
    }
  } catch (error) {
    console.error('Favorites error:', error);
    return res.status(500).json({ error: 'Ошибка при работе с избранным' });
  }
}

async function handleHistory(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    switch (req.method) {
      case 'GET':
        const history = await prisma.viewingHistory.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          include: { media: true }
        });
        return res.status(200).json(history);

      case 'POST':
        const { mediaId, duration } = req.body as Duration;
        await prisma.viewingHistory.upsert({
          where: {
            user_id_media_id: {
              user_id: userId,
              media_id: mediaId
            }
          },
          create: {
            user_id: userId,
            media_id: mediaId,
            watch_duration: duration
          },
          update: {
            watch_duration: duration,
            created_at: new Date()
          }
        });
        return res.status(200).json({ message: 'История обновлена' });

      default:
        return res.status(405).json({ error: 'Метод не разрешен' });
    }
  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({ error: 'Ошибка при работе с историей просмотров' });
  }
}

async function handleAvatar(req: NextApiRequest, res: NextApiResponse, userId: number) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  try {
    const { avatar_url } = req.body;
    await prisma.user.update({
      where: { id: userId },
      data: { avatar_url }
    });
    return res.status(200).json({ message: 'Аватар обновлен' });
  } catch (error) {
    console.error('Avatar update error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении аватара' });
  }
}

async function handleProfileInfo(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    switch (req.method) {
      case 'GET':
        const profile = await prisma.userProfile.findUnique({
          where: { user_id: userId },
          select: {
            bio: true,
            location: true,
            website: true,
            social_links: true
          }
        });
        return res.status(200).json(profile || {});

      case 'PUT':
        const { bio, location, website, social } = req.body as ProfileInfo;
        await prisma.userProfile.upsert({
          where: { user_id: userId },
          create: {
            user_id: userId,
            bio,
            location,
            website,
            social_links: social
          },
          update: {
            bio,
            location,
            website,
            social_links: social
          }
        });
        return res.status(200).json({ message: 'Профиль обновлен' });

      default:
        return res.status(405).json({ error: 'Метод не разрешен' });
    }
  } catch (error) {
    console.error('Profile info error:', error);
    return res.status(500).json({ error: 'Ошибка при обработке профиля' });
  }
}
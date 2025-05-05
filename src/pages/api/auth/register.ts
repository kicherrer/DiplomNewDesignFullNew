import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../config/database';
import { hashPassword } from '../../../utils/auth';
import { sendVerificationEmail } from '../../../utils/email';
import { generateVerificationCode } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    // Проверяем существующего пользователя и удаляем если не подтвержден
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { verification_codes: true }
    });

    if (existingUser) {
      if (existingUser.is_verified) {
        return res.status(400).json({ error: 'Email уже зарегистрирован' });
      }
      // Удаляем неподтвержденного пользователя и его коды
      await prisma.verificationCode.deleteMany({
        where: { email }
      });
      await prisma.user.delete({
        where: { email }
      });
    }

    // Генерируем код подтверждения
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    // Хешируем пароль
    const hashedPassword = await hashPassword(password);

    // Создаем пользователя
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password_hash: hashedPassword,
        verification_codes: {
          create: {
            code: verificationCode,
            expires_at: expiresAt
          }
        }
      }
    });

    // Отправляем код на почту
    const emailSent = await sendVerificationEmail(email, verificationCode);

    if (!emailSent) {
      return res.status(500).json({ error: 'Ошибка отправки email' });
    }

    return res.status(200).json({
      message: 'Пользователь успешно зарегистрирован',
      userId: user.id
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Ошибка при регистрации' });
  }
}
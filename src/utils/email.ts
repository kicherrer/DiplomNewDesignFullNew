import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendVerificationEmail = async (email: string, code: string) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Подтверждение регистрации',
      html: `
        <h1>Добро пожаловать в MediaApp!</h1>
        <p>Для завершения регистрации введите этот код на сайте:</p>
        <h2 style="color: #4A90E2; font-size: 32px; letter-spacing: 4px;">${code}</h2>
        <p>Код действителен в течение 10 минут.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};
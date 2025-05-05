import React, { useState } from 'react';
import styled from 'styled-components';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';

const AuthContainer = styled(motion.div)`
  max-width: 400px;
  margin: 40px auto;
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  overflow: hidden;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  text-align: center;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const Input = styled(motion.input)`
  padding: ${({ theme }) => theme.spacing.md};
  border: 2px solid ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  transition: all 0.3s ease;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => `${theme.colors.primary}33`};
    background: ${({ theme }) => theme.colors.background};
  }
`;

const Button = styled(motion.button)`
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px ${({ theme }) => `${theme.colors.primary}33`};

  &:hover {
    box-shadow: 0 4px 8px ${({ theme }) => `${theme.colors.primary}66`};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const SuccessMessage = styled.div`
  color: ${({ theme }) => theme.colors.success};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const ToggleAuthMode = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  text-align: center;
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.md};

  &:hover {
    text-decoration: underline;
  }
`;

interface AuthFormProps {
  onSuccess?: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const router = useRouter();
  const auth = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<'auth' | 'verify'>('auth');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.email || !formData.password) {
      setError('Пожалуйста, заполните все поля');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { success, error } = await auth.login(formData.email, formData.password);
        if (!success) {
          throw new Error(error || 'Ошибка при авторизации');
        }
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const endpoint = '/api/auth/register';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 500) {
            throw new Error('Ошибка сервера, попробуйте позже');
          }
          throw new Error(data.error || 'Ошибка при регистрации');
        }

        setSuccess('Код подтверждения отправлен на ваш email');
        setStep('verify');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при авторизации');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          code: verificationCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      localStorage.setItem('token', data.token);
      setSuccess('Email подтвержден! Перенаправляем...');
      
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => router.push('/profile'), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при подтверждении');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setStep('auth');
  };

  return (
    <AuthContainer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Title>
        {step === 'auth' ? (isLogin ? 'Вход в систему' : 'Регистрация') : 'Подтверждение email'}
      </Title>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      {step === 'auth' ? (
        <>
          <Form onSubmit={handleSubmit}>
            <Input
              type="email"
              id="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
            />
            {!isLogin && (
              <Input
                type="text"
                id="username"
                name="username"
                placeholder="Имя пользователя"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                autoComplete="username"
              />
            )}
            <Input
              type="password"
              id="password"
              name="password"
              placeholder="Пароль"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              autoComplete="current-password"
            />
            <Button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
            </Button>
          </Form>
          <ToggleAuthMode onClick={toggleAuthMode}>
            {isLogin ? 'Создать аккаунт' : 'Уже есть аккаунт? Войти'}
          </ToggleAuthMode>
        </>
      ) : (
        <Form onSubmit={handleVerify}>
          <Input
            type="text"
            id="verificationCode"
            name="verificationCode"
            placeholder="Введите код подтверждения"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            maxLength={4}
            required
            autoComplete="one-time-code"
          />
          <Button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Проверка...' : 'Подтвердить'}
          </Button>
        </Form>
      )}
    </AuthContainer>
  );
};

export default AuthForm;
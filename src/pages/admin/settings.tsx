import { useEffect, useState } from 'react';
import { Box, Container, Typography, Paper, CircularProgress } from '@mui/material';
import AdminLayout from '@/components/Admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/router';

interface ParserSettings {
  kinopoiskApiKey: string;
  omdbApiKey: string;
  updateInterval: number;
  autoUpdate: boolean;
  contentTypes: string[];
}

export default function AdminSettings() {
  const { token, isAdmin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ParserSettings | null>(null);

  useEffect(() => {
    if (!token || !isAdmin) {
      router.push('/auth/login');
      return;
    }

    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/parser', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings);
        } else {
          console.error('Ошибка при получении настроек');
        }
      } catch (error) {
        console.error('Ошибка при загрузке настроек:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [token, isAdmin, router]);

  if (loading) {
    return (
      <AdminLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Container maxWidth="lg">
        <Typography variant="h4" component="h1" gutterBottom>
          Настройки
        </Typography>
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Настройки парсера
          </Typography>
          {settings && (
            <Box>
              <Typography>API ключ Kinopoisk: {settings.kinopoiskApiKey}</Typography>
              <Typography>API ключ OMDB: {settings.omdbApiKey}</Typography>
              <Typography>Интервал обновления: {settings.updateInterval} минут</Typography>
              <Typography>Автообновление: {settings.autoUpdate ? 'Включено' : 'Выключено'}</Typography>
              <Typography>Типы контента: {settings.contentTypes.join(', ')}</Typography>
            </Box>
          )}
        </Paper>
      </Container>
    </AdminLayout>
  );
}
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, Container, Typography, Paper, CircularProgress, Avatar } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import type { Theme } from '@mui/material/styles';

interface UserProfile {
  id: number;
  email: string;
  nickname?: string;
  role: 'USER' | 'ADMIN';
  is_verified: boolean;
  created_at: string;
  avatar_url?: string;
  views_count?: number;
  favorites_count?: number;
  watchlist_count?: number;
  watch_history?: Array<{
    id: number;
    title: string;
    watched_at: string;
  }>;
  favorites?: Array<{
    id: number;
    title: string;
    added_at: string;
  }>;
  watchlist?: Array<{
    id: number;
    title: string;
    added_at: string;
  }>;
}

export default function UserProfile() {
  const router = useRouter();
  const { id } = router.query;
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!id || !token) return;

    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/profile/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        } else {
          console.error('Ошибка при получении профиля пользователя');
        }
      } catch (error) {
        console.error('Ошибка при загрузке профиля:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, token]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="lg">
        <Box mt={4}>
          <Typography variant="h5" color="error">
            Профиль не найден
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Paper 
        elevation={3} 
        sx={(theme: Theme) => ({
          mt: 4,
          p: 3,
          borderRadius: theme.shape.borderRadius,
          boxShadow: theme.shadows[3]
        })}
      >
        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={3}>
          <Box 
            flex={{ xs: '1', md: '0 0 300px' }} 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            gap={2}
          >
            <Avatar
              src={profile.avatar_url || '/default-avatar.svg'}
              sx={{ 
                width: 200, 
                height: 200,
                boxShadow: 3
              }}
            />
            <Typography 
              variant="h5"
              component="h1"
              sx={{ fontWeight: 'medium' }}
            >
              {profile.nickname || profile.email}
            </Typography>
            <Box display="flex" gap={2} mt={2}>
              <Box textAlign="center">
                <Typography variant="h6">{profile.views_count || 0}</Typography>
                <Typography variant="body2" color="textSecondary">Просмотров</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6">{profile.favorites_count || 0}</Typography>
                <Typography variant="body2" color="textSecondary">В избранном</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6">{profile.watchlist_count || 0}</Typography>
                <Typography variant="body2" color="textSecondary">В списке</Typography>
              </Box>
            </Box>
          </Box>
          
          <Box flex="1">
            <Typography 
              variant="h4"
              component="h2"
              sx={{ 
                fontWeight: 'bold',
                mb: 3
              }}
            >
              Информация о пользователе
            </Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              <Typography variant="body1" component="p">
                <Box component="strong" sx={{ fontWeight: 'bold', mr: 1 }}>Email:</Box>
                {profile.email}
              </Typography>
              <Typography variant="body1" component="p">
                <Box component="strong" sx={{ fontWeight: 'bold', mr: 1 }}>Роль:</Box>
                {profile.role}
              </Typography>
              <Typography variant="body1" component="p">
                <Box component="strong" sx={{ fontWeight: 'bold', mr: 1 }}>Статус:</Box>
                {profile.is_verified ? 'Подтвержден' : 'Не подтвержден'}
              </Typography>
              <Typography variant="body1" component="p">
                <Box component="strong" sx={{ fontWeight: 'bold', mr: 1 }}>Дата регистрации:</Box>
                {new Date(profile.created_at).toLocaleDateString()}
              </Typography>
            </Box>

            {profile.watch_history && profile.watch_history.length > 0 && (
              <Box mt={4}>
                <Typography variant="h5" sx={{ mb: 2 }}>История просмотров</Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  {profile.watch_history.map((item) => (
                    <Box key={item.id} p={2} bgcolor="background.paper" borderRadius={1}>
                      <Typography variant="body1">{item.title}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {new Date(item.watched_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {profile.favorites && profile.favorites.length > 0 && (
              <Box mt={4}>
                <Typography variant="h5" sx={{ mb: 2 }}>Избранное</Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  {profile.favorites.map((item) => (
                    <Box key={item.id} p={2} bgcolor="background.paper" borderRadius={1}>
                      <Typography variant="body1">{item.title}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Добавлено: {new Date(item.added_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {profile.watchlist && profile.watchlist.length > 0 && (
              <Box mt={4}>
                <Typography variant="h5" sx={{ mb: 2 }}>Смотреть позже</Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  {profile.watchlist.map((item) => (
                    <Box key={item.id} p={2} bgcolor="background.paper" borderRadius={1}>
                      <Typography variant="body1">{item.title}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Добавлено: {new Date(item.added_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
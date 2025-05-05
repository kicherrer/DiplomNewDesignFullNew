import { useEffect, useState } from 'react';
import { Box, Container, Typography, Paper, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, IconButton, Button, Menu, MenuItem } from '@mui/material';
import AdminLayout from '@/components/Admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/router';

interface User {
  id: number;
  email: string;
  role: string;
  is_verified: boolean;
  created_at: string;
  nickname?: string;
}

interface UserAction {
  label: string;
  action: (userId: number) => Promise<void>;
}

export default function AdminUsers() {
  const { token, isAdmin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, userId: number) => {
    setAnchorEl(event.currentTarget);
    setSelectedUserId(userId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUserId(null);
  };

  const handleAction = async (action: string) => {
    if (!selectedUserId) return;
    const controller = new AbortController();
    try {
      setLoading(true);
      const response = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedUserId,
          action: action
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Ошибка при обновлении пользователя');
      }

      const updatedUsers = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      }).then(res => {
        if (!res.ok) throw new Error('Ошибка при получении обновленного списка');
        return res.json();
      });
      
      setUsers(updatedUsers);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') return;
        console.error('Ошибка при обновлении пользователя:', error.message);
      }
    } finally {
      setLoading(false);
      handleMenuClose();
    }

    return () => controller.abort();
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.id.toString().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      (user.nickname?.toLowerCase() || '').includes(searchLower)
    );
  });

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!token || !isAdmin) {
        await router.push('/auth/login');
        return;
      }
    };
    
    checkAdminAccess();

    let isSubscribed = true;
    const controller = new AbortController();

    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/users', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal
        });

        if (!isSubscribed) return;

        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        } else {
          console.error('Ошибка при получении списка пользователей');
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') return;
          console.error('Ошибка при загрузке пользователей:', error.message);
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      isSubscribed = false;
      controller.abort();
    };
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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Пользователи
          </Typography>
          <TextField
            placeholder="Поиск по ID, email или никнейму"
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 300 }}
          />
        </Box>
        <Paper elevation={3} sx={{ mt: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Роль</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Дата регистрации</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} style={{ cursor: 'pointer' }}>
                    <TableCell onClick={() => router.push(`/profile/${user.id}`)}>{user.id}</TableCell>
                    <TableCell onClick={() => router.push(`/profile/${user.id}`)}>{user.email}</TableCell>
                    <TableCell onClick={() => router.push(`/profile/${user.id}`)}>{user.role}</TableCell>
                    <TableCell onClick={() => router.push(`/profile/${user.id}`)}>{user.is_verified ? 'Подтвержден' : 'Не подтвержден'}</TableCell>
                    <TableCell onClick={() => router.push(`/profile/${user.id}`)}>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => router.push(`/profile/${user.id}`)}
                        >
                          Профиль
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={(e) => handleMenuOpen(e, user.id)}
                        >
                          Действия
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => handleAction('makeAdmin')}>Назначить администратором</MenuItem>
          <MenuItem onClick={() => handleAction('removeAdmin')}>Убрать права администратора</MenuItem>
          <MenuItem onClick={() => handleAction('block')}>Заблокировать</MenuItem>
          <MenuItem onClick={() => handleAction('unblock')}>Разблокировать</MenuItem>
        </Menu>
      </Container>
    </AdminLayout>
  );
}
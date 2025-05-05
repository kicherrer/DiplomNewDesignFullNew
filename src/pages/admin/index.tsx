import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/Admin/AdminLayout';
import styled from 'styled-components';
import { useAuth } from '@/hooks/useAuth';

const DashboardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.card};
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
`;

interface DashboardStats {
  totalContent: number;
  activeUsers: number;
  parserStatus: string;
}

const AdminDashboard = () => {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalContent: 0,
    activeUsers: 0,
    parserStatus: 'inactive'
  });

  const loadDashboardStats = async () => {
    try {
      setIsLoading(true);
      const cachedStats = sessionStorage.getItem('adminDashboardStats');
      const lastUpdate = sessionStorage.getItem('adminDashboardStatsTime');
      
      // Используем кэшированные данные, если они не старше 5 минут
      if (cachedStats && lastUpdate && (Date.now() - Number(lastUpdate)) < 300000) {
        setStats(JSON.parse(cachedStats));
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Ошибка при загрузке статистики');
      
      const data = await response.json();
      setStats(data);
      
      // Кэшируем полученные данные
      sessionStorage.setItem('adminDashboardStats', JSON.stringify(data));
      sessionStorage.setItem('adminDashboardStatsTime', Date.now().toString());
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      if (authLoading) return;
      
      if (!user || user.role !== 'ADMIN') {
        router.push('/auth/login');
        return;
      }

      if (mounted) {
        setIsAuthorized(true);
        await loadDashboardStats();
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [user, router, authLoading]);

  if (!isAuthorized) {
    return authLoading ? <div>Загрузка...</div> : null;
  }

  return (
    <AdminLayout>
      <h1>Панель управления</h1>
      {isLoading ? (
        <div>Загрузка...</div>
      ) : (
        <DashboardContainer>
          <Card onClick={() => router.push('/admin/content')}>
            <h3>Контент</h3>
            <p>Управление фильмами и сериалами</p>
            <p>Всего контента: {stats.totalContent}</p>
          </Card>
          <Card onClick={() => router.push('/admin/parser')}>
            <h3>Парсер</h3>
            <p>Настройка и мониторинг парсера</p>
            <p>Статус: {stats.parserStatus}</p>
          </Card>
          <Card onClick={() => router.push('/admin/users')}>
            <h3>Пользователи</h3>
            <p>Управление пользователями</p>
            <p>Активных пользователей: {stats.activeUsers}</p>
          </Card>
          <Card onClick={() => router.push('/admin/settings')}>
            <h3>Система</h3>
            <p>Системные настройки</p>
          </Card>
        </DashboardContainer>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import styled from 'styled-components';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Parser from './Parser';
import { debounce } from 'lodash';

const AdminLayoutContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.background};
`;

const MainContent = styled.div`
  flex: 1;
  margin-left: 280px;
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.background};
`;

const Content = styled.div`
  padding: 2rem;
  background-color: ${({ theme }) => theme.colors.background};
`;

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { logout, isAuthenticated, isAdmin, isLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    newContent: 0
  });
  const navigationController = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleRouteChange = () => {
      setIsNavigating(false);
      if (navigationController.current) {
        navigationController.current = null;
      }
    };

    const handleRouteError = (err: Error) => {
      if (err.name !== 'AbortError') {
        console.error('Navigation error:', err);
      }
      setIsNavigating(false);
      if (navigationController.current) {
        navigationController.current = null;
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    router.events.on('routeChangeError', handleRouteError);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      router.events.off('routeChangeError', handleRouteError);
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (navigationController.current) {
        navigationController.current.abort();
        navigationController.current = null;
      }
    };
  }, []);

  const handleNavigation = useCallback(async (path: string) => {
    if (isNavigating || path === router.pathname) return;
    
    if (navigationController.current) {
      navigationController.current.abort();
    }
    navigationController.current = new AbortController();
    
    setIsNavigating(true);
    try {
      await router.push(path, undefined, { 
        shallow: false
      });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Navigation error:', error);
      }
    } finally {
      setIsNavigating(false);
    }
  }, [router, isNavigating]);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      if (isLoading) return;

      const token = localStorage.getItem('token');
      if (!token || !isAuthenticated || !isAdmin) {
        if (isMounted) {
          setIsAuthorized(false);
          const currentPath = router.pathname;
          if (currentPath !== '/auth/login') {
            localStorage.setItem('adminPath', currentPath);
            router.replace('/auth/login');
          }
        }
        return;
      }

      if (isMounted) {
        setIsAuthorized(true);
      }
    };

    checkAuth();
    
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAdmin, isLoading, router.pathname]);

  const fetchStats = useCallback(async () => {
    try {
      const cachedStats = sessionStorage.getItem('adminStats');
      const lastFetchTime = sessionStorage.getItem('statsLastFetchTime');
      const now = Date.now();

      if (cachedStats && lastFetchTime && (now - parseInt(lastFetchTime)) < 300000) {
        setStats(JSON.parse(cachedStats));
        return;
      }

      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        sessionStorage.setItem('adminStats', JSON.stringify(data));
        sessionStorage.setItem('statsLastFetchTime', now.toString());
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      const cachedStats = sessionStorage.getItem('adminStats');
      if (cachedStats) {
        setStats(JSON.parse(cachedStats));
      }
    }
  }, []);

  const debouncedFetchStats = useRef(
    debounce(fetchStats, 1000, { leading: true, trailing: false })
  ).current;

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isAuthorized) {
      debouncedFetchStats();
      timeoutId = setInterval(debouncedFetchStats, 300000); // Обновление каждые 5 минут
    }
    return () => {
      if (timeoutId) clearInterval(timeoutId);
      debouncedFetchStats.cancel();
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized && router.pathname === '/auth/login') {
      const savedPath = localStorage.getItem('adminPath');
      if (savedPath) {
        router.replace(savedPath);
        localStorage.removeItem('adminPath');
      } else {
        router.replace('/admin');
      }
    }
  }, [isAuthorized, router.pathname]);



  const handleLogout = async () => {
    localStorage.removeItem('adminPath');
    await handleNavigation('/');
  };

  return (
    <AdminLayoutContainer>
      <AdminSidebar onLogout={handleLogout} />
      <MainContent>
        <AdminHeader stats={stats} currentPath={router.pathname} />
        <Content>{children}</Content>
      </MainContent>
    </AdminLayoutContainer>
  );
};

export default AdminLayout;
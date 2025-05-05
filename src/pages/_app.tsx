import type { AppProps } from 'next/app';
import { Provider } from 'react-redux';
import { store } from '../store';
import { ThemeProvider } from 'styled-components';
import { theme } from '../styles/theme';
import { GlobalStyle } from '../styles/globalStyles';
import { WebSocketProvider } from '../components/WebSocket/WebSocketProvider';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    let isCheckingAuth = false;
    let authCheckInterval: NodeJS.Timeout;

    const checkAuth = async () => {
      if (isCheckingAuth || router.pathname.startsWith('/auth')) return;
      
      try {
        isCheckingAuth = true;
        if (!token) {
          throw new Error('Токен отсутствует');
        }

        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          },
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          const errorMessage = data.error || 'Ошибка проверки токена';
          throw new Error(errorMessage);
        }
        
        if (!data.isValid) {
          throw new Error('Токен недействителен');
        }

        // Токен валиден, обновляем информацию
        return true;
      } catch (error) {
        console.error('Ошибка при проверке токена:', error);
        localStorage.removeItem('token');
        if (!router.pathname.startsWith('/auth')) {
          await router.push('/auth/login');
        }
        return false;
      } finally {
        isCheckingAuth = false;
      }
    };

    if (token && !router.pathname.startsWith('/auth')) {
      checkAuth();
      authCheckInterval = setInterval(checkAuth, 5 * 60 * 1000); // Каждые 5 минут
    } else if (!token && !router.pathname.startsWith('/auth')) {
      router.push('/auth/login');
    }

    return () => {
      if (authCheckInterval) {
        clearInterval(authCheckInterval);
      }
    };
  }, [router]);

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <WebSocketProvider>
          <Component {...pageProps} />
        </WebSocketProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default MyApp;
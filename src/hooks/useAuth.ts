import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { loginStart, loginSuccess, loginFailure, logout as logoutAction } from '../store/slices/authSlice';
import { setProfile, clearProfile, setLoading, setError } from '../store/slices/userSlice';
import { RootState } from '../store';

const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

const setToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }
};

const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
};

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatar_id?: string;
  avatar_url?: string;
  views_count?: number;
  favorites_count?: number;
  watchlist_count?: number;
  created_at?: string;
  updated_at?: string;
}

export const useAuth = () => {
  const router = useRouter();
  const currentPath = router.pathname;
  const dispatch = useDispatch();
  const { isAuthenticated, loading: authLoading, error: authError } = useSelector((state: RootState) => state.auth);
  const { profile: user, loading: userLoading, error: userError } = useSelector((state: RootState) => state.user);
  const isLoading = authLoading || userLoading;
  const lastCheckRef = useRef<number>(0);
  const CHECK_INTERVAL = 300000; // 5 минут между проверками
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCheckAuth = () => {
    return new Promise<void>((resolve) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (!navigator.onLine) {
        resolve();
        return;
      }
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await checkAuth();
        } catch (error) {
          console.error('Ошибка при проверке авторизации:', error);
        } finally {
          resolve();
        }
      }, 300);
    });
  };

  const shouldCheckAuth = () => {
    const now = Date.now();
    if (now - lastCheckRef.current >= CHECK_INTERVAL) {
      lastCheckRef.current = now;
      return true;
    }
    return false;
  };

  const checkAuthImmediately = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await checkAuth();
  };

  const refreshTokenRef = useRef<{
    lastAttempt: number;
    retryCount: number;
    retryDelay: number;
    isRefreshing: boolean;
  }>({ lastAttempt: 0, retryCount: 0, retryDelay: 5000, isRefreshing: false });

  const refreshToken = async () => {
    try {
      const currentToken = getToken();
      if (!currentToken) return false;

      const now = Date.now();
      const { lastAttempt, retryCount, retryDelay, isRefreshing } = refreshTokenRef.current;

      // Предотвращаем параллельные запросы на обновление токена
      if (isRefreshing) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return false;
      }

      // Проверяем минимальный интервал между запросами
      if (now - lastAttempt < retryDelay) {
        const waitTime = retryDelay - (now - lastAttempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      refreshTokenRef.current.isRefreshing = true;
      refreshTokenRef.current.lastAttempt = now;

      // Увеличиваем задержку экспоненциально с большим начальным значением
      if (retryCount > 0) {
        refreshTokenRef.current.retryDelay = Math.min(retryDelay * 2, 60000); // Максимальная задержка 1 минута
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Увеличенный таймаут

      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
          },
          credentials: 'include',
          signal: controller.signal
        });
        
        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            dispatch(logoutAction());
            dispatch(clearProfile());
            removeToken();
            return false;
          } else if (response.status === 429) {
            refreshTokenRef.current.retryCount++;
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
            refreshTokenRef.current.retryDelay = Math.max(retryAfter * 1000, refreshTokenRef.current.retryDelay);
            throw new Error(`Слишком много попыток обновления токена. Повторите через ${Math.ceil(refreshTokenRef.current.retryDelay / 1000)} секунд.`);
          }
          throw new Error(data.error || 'Ошибка обновления токена');
        }

        if (!data.token) {
          throw new Error('Токен не получен от сервера');
        }

        // Сброс счетчиков при успешном обновлении
        refreshTokenRef.current = { lastAttempt: now, retryCount: 0, retryDelay: 5000, isRefreshing: false };

        setToken(data.token);
        dispatch(loginSuccess({ token: data.token, role: data.role }));
        return true;
      } finally {
        clearTimeout(timeoutId);
        controller.abort();
        refreshTokenRef.current.isRefreshing = false;
      }
    } catch (error) {
      console.error('Ошибка обновления токена:', error);
      return false;
    }
  };

  const isAuthPage = router.pathname.startsWith('/auth/');
  const isAdminPage = router.pathname.startsWith('/admin/');

  useEffect(() => {
    const token = getToken();
    let isSubscribed = true;
    let isMounted = true;
    let authCheckTimeout: NodeJS.Timeout | null = null;
    let authCheckInterval: NodeJS.Timeout | null = null;
    const navigationController = new AbortController();

    // Проверка прав доступа к админ-панели
    const checkAdminAccess = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.isValid || data.role !== 'ADMIN') {
          if (isAdminPage) {
            await handleNavigation('/auth/login');
            return false;
          }
        }
        return true;
      } catch (error) {
        console.error('Ошибка проверки прав администратора:', error);
        if (isAdminPage) {
          await handleNavigation('/auth/login');
          return false;
        }
        return false;
      }
    };
    
    const handleNavigation = async (path: string) => {
      if (!isMounted) return;
      try {
        await router.push(path, undefined, { 
          shallow: true,
          scroll: false 
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Ошибка навигации:', error);
        }
      }
    };

    const initAuth = async () => {
      if (!isSubscribed || !isMounted) return;

      if (!token || !navigator.onLine) {
        dispatch(logoutAction());
        dispatch(clearProfile());
        if (!isAuthPage) {
          await handleNavigation('/auth/login');
        }
        return;
      }

      // Проверяем права доступа к админ-панели
      if (isAdminPage) {
        const hasAccess = await checkAdminAccess();
        if (!hasAccess) return;
      }

      try {
        if (shouldCheckAuth()) {
          await debouncedCheckAuth();
          
          if (!isSubscribed || !isMounted) return;
          
          if (isAuthenticated && isAuthPage) {
            await handleNavigation('/');
            return;
          }
          
          // Проверяем права доступа после успешной проверки авторизации
          if (isAdminPage) {
            await checkAdminAccess();
            return;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Ошибка инициализации авторизации:', error);
          if (!isAuthPage) {
            await handleNavigation('/auth/login');
          }
        }
      }
    };

    const scheduleNextCheck = () => {
      if (authCheckTimeout) clearTimeout(authCheckTimeout);
      if (authCheckInterval) clearInterval(authCheckInterval);
      
      if (isSubscribed && isMounted && !isAuthPage) {
        authCheckInterval = setInterval(() => {
          if (navigator.onLine) {
            initAuth().catch((error) => {
              if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Ошибка проверки авторизации:', error);
              }
            });
          }
        }, CHECK_INTERVAL);
      }
    };

    const cleanup = () => {
      isSubscribed = false;
      isMounted = false;
      navigationController.abort();
      if (authCheckTimeout) clearTimeout(authCheckTimeout);
      if (authCheckInterval) clearInterval(authCheckInterval);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };

    initAuth().finally(() => {
      if (isSubscribed && isMounted) {
        scheduleNextCheck();
      }
    });
    
    return cleanup;
  }, [router.pathname, isAuthenticated, user?.role]);

  useEffect(() => {
    let isMounted = true;
    
    const checkAndRedirect = async () => {
      const token = getToken();
      if (!token && !isAuthPage && isMounted) {
        try {
          await router.push('/auth/login', undefined, { 
            shallow: true,
            scroll: false 
          });
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Ошибка навигации:', error);
          }
        }
      }
    };

    checkAndRedirect();
    
    return () => {
      isMounted = false;
    };
  }, [isAuthPage, router]);

  const checkAuthRef = useRef<{
    lastVerifyAttempt: number;
    verifyRetryCount: number;
    verifyRetryDelay: number;
  }>({ lastVerifyAttempt: 0, verifyRetryCount: 0, verifyRetryDelay: 2000 });

  const checkAuth = async () => {
    const token = getToken();
    
    if (!token) {
      dispatch(logoutAction());
      dispatch(clearProfile());
      return false;
    }

    try {
      dispatch(setLoading(true));
      const profileResponse = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        credentials: 'include'
      });

      if (!profileResponse.ok) {
        throw new Error('Ошибка получения профиля пользователя');
      }

      const userData = await profileResponse.json();
      
      dispatch(loginSuccess({ token, role: userData.role }));
      dispatch(setProfile(userData));
      return true;
    } catch (error) {
      console.error('Ошибка при проверке авторизации:', error);
      dispatch(logoutAction());
      dispatch(clearProfile());
      removeToken();
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  };

  interface LoginResponse {
    success: boolean;
    error?: string;
  }

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      dispatch(loginStart());
      dispatch(setLoading(true));

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      const data = await res.json();

      if (!res.ok || !data?.token) {
        throw new Error(data?.error || 'Ошибка авторизации');
      }

      setToken(data.token);
      
      const userData = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${data.token}`
        },
        credentials: 'include'
      }).then(res => res.json());

      dispatch(loginSuccess({ token: data.token, role: userData.role }));
      dispatch(setProfile(userData));
      
      await router.push('/', undefined, { 
        shallow: true, 
        scroll: false 
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при входе';
      dispatch(loginFailure(errorMessage));
      return { success: false, error: errorMessage };
    } finally {
      dispatch(setLoading(false));
    }
  };

  const logout = () => {
    removeToken();
    dispatch(logoutAction());
    dispatch(clearProfile());
    router.push('/auth/login', undefined, { 
      shallow: true,
      scroll: false 
    }).catch((error) => {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Ошибка навигации при выходе:', error);
      }
    });
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    const token = getToken();
    if (!token) throw new Error('Не авторизован');

    try {
      dispatch(setLoading(true));
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      await checkAuth();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при обновлении профиля';
      dispatch(setError(errorMessage));
      throw new Error(errorMessage);
    }
  };

  const uploadAvatar = async (file: File): Promise<void> => {
    const token = getToken();
    if (!token) throw new Error('Не авторизован');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      await checkAuth();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Ошибка при загрузке аватара');
    }
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    login,
    logout,
    updateProfile,
    uploadAvatar,
    token: getToken(),
    isAdmin: user?.role === 'ADMIN',
    error: authError || userError
  };
};
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/Admin/AdminLayout';
import styled from 'styled-components';
import { useAuth } from '@/hooks/useAuth';
import ParserHistory from '@/components/Admin/ParserHistory';
import { useTheme } from 'styled-components';
import Typography from '@mui/material/Typography';

interface ContentUpdateData {
  title?: string;
  type?: 'movie' | 'series';
  posterUrl?: string;
  source?: string;
}

interface ParserSettings {
  updateInterval: number;
  autoUpdate: boolean;
  contentTypes: Array<'movies' | 'series'>;
  lastUpdate?: string;
  isEnabled: boolean;
}

interface ParserStatus {
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  lastRun: string | null;
  processedItems: number;
  errors: string[];
}

const ParserContainer = styled.div`
  padding: 2rem;
  background: ${({ theme }) => theme.colors.background};
`;

const Section = styled.div`
  background: ${({ theme }) => theme.colors.card};
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
`;

const FormGroup = styled.div`
  margin-bottom: 1.25rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => `${theme.colors.primary}22`};
  }
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 150px;
  font-weight: 600;
  box-shadow: 0 2px 4px ${({ theme }) => `${theme.colors.primary}33`};
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px ${({ theme }) => `${theme.colors.primary}66`};
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const StatusIndicator = styled.div<{ status: 'ACTIVE' | 'INACTIVE' | 'ERROR' }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  background-color: ${({ status }) =>
    status === 'ACTIVE' ? '#10B981' :
    status === 'INACTIVE' ? '#6B7280' : '#EF4444'};
  box-shadow: 0 2px 4px ${({ status }) =>
    status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' :
    status === 'INACTIVE' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)'};

  &::before {
    content: '';
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: white;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
    animation: ${({ status }) => status === 'ACTIVE' ? 'pulse 1.5s infinite' : 'none'};
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.5; }
    100% { transform: scale(1); opacity: 1; }
  }
`;

const ParserManagement = () => {
  const theme = useTheme();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ParserStatus>({
    status: 'INACTIVE',
    lastRun: null,
    processedItems: 0,
    errors: []
  });
  const [settings, setSettings] = useState<ParserSettings>({
    updateInterval: 24,
    autoUpdate: true,
    contentTypes: [] as Array<'movies' | 'series'>,
    isEnabled: false,
    lastUpdate: undefined
  });
  const router = useRouter();
  const { user } = useAuth();

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const loadParserSettings = useCallback(async () => {
    if (!isAuthorized || isLoading) return;
    
    try {
      const controller = new AbortController();
      const response = await fetch('/api/admin/parser', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Ошибка при загрузке настроек');
      }

      const data = await response.json();
      if (data.settings) {
        setSettings(prev => ({
          ...prev,
          ...data.settings
        }));
      }
      if (data.status) {
        setStatus(prev => ({
          ...prev,
          ...data.status
        }));
      }
      return () => controller.abort();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error loading parser settings:', error);
      showError(error instanceof Error ? error.message : 'Ошибка при загрузке настроек');
    }
  }, [isAuthorized, isLoading, showError]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const fetchStatus = async () => {
      if (!isMounted || !isAuthorized || status.status !== 'ACTIVE') return;
      
      await loadParserSettings();
      timeoutId = setTimeout(fetchStatus, 5000);
    };

    fetchStatus();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isAuthorized, status.status, loadParserSettings]);

  useEffect(() => {
    let isMounted = true;
    
    if (isAuthorized && isMounted) {
      loadParserSettings();
    }
    
    return () => {
      isMounted = false;
    };
  }, [isAuthorized, loadParserSettings]);

  useEffect(() => {
    if (!user && !isLoading) {
      router.push('/auth/login');
      return;
    }

    if (user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    setIsAuthorized(true);
  }, [user, router, isLoading]);

  if (!isAuthorized) {
    return null;
  }

  const handleSettingsUpdate = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/parser', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка при сохранении настроек');
      }
      
      showError('Настройки успешно сохранены');
      await loadParserSettings();
    } catch (error) {
      console.error('Error updating parser settings:', error);
      showError(error instanceof Error ? error.message : 'Ошибка при сохранении настроек');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartParser = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const action = status.status === 'ACTIVE' ? 'stop' : 'start';
      const response = await fetch(`/api/admin/parser?action=${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Ошибка при ${action === 'start' ? 'запуске' : 'остановке'} парсера`);
      }
      
      setStatus(prev => ({
        ...prev,
        status: action === 'start' ? 'ACTIVE' : 'INACTIVE',
        lastRun: action === 'start' ? new Date().toISOString() : prev.lastRun,
        errors: []
      }));

      showError(action === 'start' ? 'Парсер успешно запущен' : 'Парсер остановлен');
    } catch (error: unknown) {
      console.error('Error:', error);
      setError((error as { message?: string }).message || 'Ошибка при выполнении операции');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <ParserContainer>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', color: theme.colors.text }}>Управление парсером</h1>

        <Section>
          <h2>Статус парсера</h2>
          <div className="status-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
            <StatusIndicator status={status.status.toLowerCase() as 'ACTIVE' | 'INACTIVE' | 'ERROR'}>
              {status.status === 'ACTIVE' ? 'Активен' :
               status.status === 'INACTIVE' ? 'Неактивен' : 'Ошибка'}
            </StatusIndicator>
            <p>Последний запуск: {status.lastRun ? 
              new Date(status.lastRun).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : 'Нет данных'}</p>
            <p>Обработано элементов: {status.processedItems}</p>
            {status.errors.length > 0 && (
              <div>
                <h3>Ошибки:</h3>
                <ul>
                  {status.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={handleStartParser} disabled={isLoading}>
              {isLoading ? 'Загрузка...' :
               status.status === 'ACTIVE' ? 'Остановить парсер' : 'Запустить парсер'}
            </Button>
          </div>
        </Section>

        <Section>
          <h2>Настройки парсера</h2>

          <FormGroup>
            <Label>Интервал обновления (часы)</Label>
            <Input
              type="number"
              value={settings.updateInterval}
              onChange={(e) => setSettings(prev => ({ ...prev, updateInterval: parseInt(e.target.value) }))}
            />
          </FormGroup>
          <FormGroup>
            <Label>
              <input
                type="checkbox"
                checked={settings.autoUpdate}
                onChange={(e) => setSettings(prev => ({ ...prev, autoUpdate: e.target.checked }))}
              />
              Автоматическое обновление
            </Label>
          </FormGroup>
          <FormGroup>
            <Label>Типы контента</Label>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={settings.contentTypes.includes('movies')}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...settings.contentTypes, 'movies'] as Array<'movies' | 'series'>
                      : settings.contentTypes.filter(t => t !== 'movies') as Array<'movies' | 'series'>;
                    setSettings(prev => ({ ...prev, contentTypes: newTypes }));
                  }}
                />
                Фильмы
              </label>
              <label style={{ marginLeft: '20px' }}>
                <input
                  type="checkbox"
                  checked={settings.contentTypes.includes('series')}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...settings.contentTypes, 'series'] as Array<'movies' | 'series'>
                      : settings.contentTypes.filter(t => t !== 'series') as Array<'movies' | 'series'>;
                    setSettings(prev => ({ ...prev, contentTypes: newTypes }));
                  }}
                />
                Сериалы
              </label>
            </div>
          </FormGroup>
          {error && (
            <div style={{ color: error.includes('успешно') ? 'green' : 'red', marginBottom: '10px' }}>
              {error}
            </div>
          )}
          <Button onClick={handleSettingsUpdate} disabled={isLoading}>
            {isLoading ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </Section>

        <ParserHistory
          onUpdateContent={async (id: string, data: ContentUpdateData) => {
            try {
              const response = await fetch(`/api/admin/parser/content/${id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
              });
              if (!response.ok) throw new Error('Ошибка при обновлении контента');
            } catch (error) {
              console.error('Error updating content:', error);
              throw error;
            }
          }}
          onDeleteContent={async (id: string) => {
            try {
              const response = await fetch(`/api/admin/parser/content/${id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                }
              });
              if (!response.ok) throw new Error('Ошибка при удалении контента');
            } catch (error) {
              console.error('Error deleting content:', error);
              throw error;
            }
          }}
        />
      </ParserContainer>
    </AdminLayout>
  );
};

export default ParserManagement;
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Tab, Tabs, Typography, Paper, CircularProgress, List, ListItem, ListItemText } from '@mui/material';
import { styled } from '@mui/material/styles';

const ParserContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  '& .MuiPaper-root': {
    marginTop: theme.spacing(2)
  }
}));

const LogItem = styled(ListItem)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:last-child': {
    borderBottom: 'none'
  }
}));

interface ParserLog {
  id: number;
  message: string;
  error: string;
  timestamp: string;
}

interface ParserStatus {
  status: 'active' | 'inactive' | 'error';
  lastRun?: Date;
  processedItems: number;
  errors: string[];
}

interface ParserSettings {
  kinopoiskApiKey: string;
  omdbApiKey: string;
  updateInterval: number;
  autoUpdate: boolean;
  contentTypes: string[];
}

interface ParserProps {
  onError?: (error: string) => void;
}

const Parser: React.FC<ParserProps> = ({ onError }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [status, setStatus] = useState<ParserStatus | null>(null);
  const [settings, setSettings] = useState<ParserSettings | null>(null);
  const [logs, setLogs] = useState<ParserLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const handleError = useCallback((message: string) => {
    setError(message);
    onError?.(message);
    setTimeout(() => setError(null), 5000);
  }, [onError]);

  const fetchData = useCallback(async (endpoint: string, signal: AbortSignal) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Токен авторизации не найден');

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      signal
    });

    if (!response.ok) {
      if (response.status === 503) throw new Error('Сервис временно недоступен');
      const data = await response.json();
      throw new Error(data.error || 'Ошибка при загрузке данных');
    }

    return response.json();
  }, []);

  const updateParserStatus = useCallback(async () => {
    const now = Date.now();
    if (now - lastUpdate < 3000) return; // Добавляем debounce
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const data = await fetchData('/api/admin/parser', controller.signal);
      setStatus(data.status);
      setSettings(data.settings);
      setError(null);
      setLastUpdate(now);

      if (activeTab === 1) {
        const logsData = await fetchData('/api/admin/parser/logs', controller.signal);
        setLogs(logsData);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        handleError(err.message);
      }
    } finally {
      setLoading(false);
      clearTimeout(timeoutId);
    }
  }, [activeTab, fetchData, handleError, lastUpdate]);

  const startParser = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/parser?action=start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kinopoiskApiKey: settings?.kinopoiskApiKey,
          omdbApiKey: settings?.omdbApiKey
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      await updateParserStatus();
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Ошибка при запуске парсера');
    }
  }, [settings, updateParserStatus, handleError]);

  const stopParser = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/parser?action=stop', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      await updateParserStatus();
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Ошибка при остановке парсера');
    }
  }, [updateParserStatus, handleError]);

  useEffect(() => {
    let isSubscribed = true;
    const controller = new AbortController();

    const loadData = async () => {
      if (!isSubscribed) return;
      await updateParserStatus();
    };

    loadData();
    const interval = setInterval(loadData, status?.status === 'active' ? 10000 : 30000); // Увеличиваем интервалы

    return () => {
      isSubscribed = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [status?.status, updateParserStatus]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ParserContainer>
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>Парсер контента</Typography>
        {error && (
          <Typography color="error" gutterBottom>{error}</Typography>
        )}
      </Box>

      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
        <Tab label="Статус" />
        <Tab label="Логи" />
      </Tabs>

      {activeTab === 0 && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Текущий статус</Typography>
          <Box my={2}>
            <Typography>
              Статус: {status?.status === 'active' ? 'Активен' : status?.status === 'error' ? 'Ошибка' : 'Неактивен'}
            </Typography>
            {status?.lastRun && (
              <Typography>
                Последний запуск: {new Date(status.lastRun).toLocaleString()}
              </Typography>
            )}
            <Typography>
              Обработано элементов: {status?.processedItems || 0}
            </Typography>
          </Box>
          <Box mt={3}>
            <Button
              variant="contained"
              color="primary"
              onClick={startParser}
              disabled={status?.status === 'active'}
              sx={{ mr: 2 }}
            >
              Запустить парсер
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={stopParser}
              disabled={status?.status !== 'active'}
            >
              Остановить парсер
            </Button>
          </Box>
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper elevation={2}>
          <List>
            {logs.map((log) => (
              <LogItem key={log.id}>
                <ListItemText
                  primary={log.message}
                  secondary={`${new Date(log.timestamp).toLocaleString()}${log.error ? ` - Ошибка: ${log.error}` : ''}`}
                  sx={{
                    '& .MuiListItemText-primary': {
                      color: log.error ? 'error.main' : 'text.primary'
                    }
                  }}
                />
              </LogItem>
            ))}
          </List>
        </Paper>
      )}
    </ParserContainer>
  );
};

export default Parser;
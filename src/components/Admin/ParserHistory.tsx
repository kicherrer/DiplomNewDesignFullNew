import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Paper, Typography, List, ListItem, ListItemText, CircularProgress, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FiEdit2, FiTrash2, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const HistoryContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2)
}));

const HistoryItem = styled(ListItem)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:last-child': {
    borderBottom: 'none'
  },
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start'
}));

const PaginationContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginTop: theme.spacing(2)
}));

interface ContentItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  posterUrl: string;
  addedAt: string;
  source: string;
}

interface ParserHistoryProps {
  onUpdateContent: (id: string, data: Partial<ContentItem>) => Promise<void>;
  onDeleteContent: (id: string) => Promise<void>;
}

const ParserHistory: React.FC<ParserHistoryProps> = ({
  onUpdateContent,
  onDeleteContent,
}) => {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ContentItem>>({});
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const itemsPerPage = 20;

  const totalPages = useMemo(() => Math.ceil(content.length / itemsPerPage), [content.length]);
  
  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return content.slice(startIndex, startIndex + itemsPerPage);
  }, [content, currentPage]);

  const fetchHistory = useCallback(async () => {
    if (loading) return;
    
    const now = Date.now();
    if (now - lastUpdate < 5000) return; // Добавляем debounce
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) throw new Error('Токен авторизации не найден');

      const response = await fetch('/api/admin/parser/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при загрузке истории');
      }

      const data = await response.json();
      setContent(data);
      setLastUpdate(now);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      clearTimeout(timeoutId);
      controller.abort();
    }
  }, [loading, lastUpdate]);

  useEffect(() => {
    let isSubscribed = true;
    const intervalId = setInterval(() => {
      if (isSubscribed) fetchHistory();
    }, 60000); // Увеличиваем интервал обновления до 1 минуты

    fetchHistory();

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [fetchHistory]);

  const handleEdit = (item: ContentItem) => {
    setEditItem(item);
    setEditFormData({
      title: item.title,
      type: item.type,
      source: item.source
    });
  };

  const handleEditSubmit = async () => {
    if (!editItem || !editFormData) return;

    try {
      await onUpdateContent(editItem.id, editFormData);
      setContent(prevContent =>
        prevContent.map(item =>
          item.id === editItem.id ? { ...item, ...editFormData } : item
        )
      );
      setEditItem(null);
      setEditFormData({});
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDeleteContent(id);
      setContent(prevContent => prevContent.filter(item => item.id !== id));
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  if (loading && !content.length) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <HistoryContainer>
      <Typography variant="h6" gutterBottom>
        История парсера
      </Typography>
      {error && (
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
      )}
      <List>
        {currentItems.map((item) => (
          <HistoryItem key={item.id}>
            <ListItemText
              primary={item.title}
              secondary={
                <>
                  <Typography component="span" display="block">
                    {item.type} | {item.source}
                  </Typography>
                  <Typography component="span" display="block" variant="caption">
                    {new Date(item.addedAt).toLocaleString('ru-RU', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Typography>
                </>
              }
            />
            <Box>
              <IconButton size="small" onClick={() => handleEdit(item)}>
                <FiEdit2 />
              </IconButton>
              <IconButton size="small" onClick={() => handleDelete(item.id)}>
                <FiTrash2 />
              </IconButton>
            </Box>
          </HistoryItem>
        ))}
      </List>

      <PaginationContainer>
        <IconButton
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          <FiChevronLeft />
        </IconButton>
        <Typography>
          Страница {currentPage} из {totalPages}
        </Typography>
        <IconButton
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
        >
          <FiChevronRight />
        </IconButton>
      </PaginationContainer>

      <Dialog open={!!editItem} onClose={() => setEditItem(null)}>
        <DialogTitle>Редактировать элемент</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Название"
            value={editFormData.title || ''}
            onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Тип"
            value={editFormData.type || ''}
            onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value as 'movie' | 'series' }))}
            margin="normal"
            select
            SelectProps={{ native: true }}
          >
            <option value="movie">Фильм</option>
            <option value="series">Сериал</option>
          </TextField>
          <TextField
            fullWidth
            label="Источник"
            value={editFormData.source || ''}
            onChange={(e) => setEditFormData(prev => ({ ...prev, source: e.target.value }))}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItem(null)}>Отмена</Button>
          <Button onClick={handleEditSubmit} color="primary">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </HistoryContainer>
  );
};

export default ParserHistory;
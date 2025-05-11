import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/Admin/AdminLayout';
import styled from 'styled-components';
import { useAuth } from '@/hooks/useAuth';

const EditContainer = styled.div`
  padding: 20px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  &.image-preview {
    .preview-container {
      margin-top: 10px;
      max-width: 300px;
      img {
        width: 100%;
        height: auto;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
    }
  }
`;

const Label = styled.label`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const TextArea = styled.textarea`
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  min-height: 100px;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Select = styled.select`
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Button = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  cursor: pointer;
  font-weight: 600;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  margin-top: 10px;
`;

interface Genre {
  id: number;
  name: string;
}

interface MediaFile {
  id: number;
  type: MediaFileType;
  title?: string;
  url: string;
  episode_number?: number;
  season_number?: number;
}

type MediaFileType = 'TRAILER' | 'MOVIE' | 'EPISODE';

interface MediaItem {
  id: number;
  title: string;
  original_title?: string;
  type: 'MOVIE' | 'SERIES';
  description?: string;
  poster_url?: string;
  backdrop_url?: string;
  release_date?: string;
  rating: number;
  duration?: number;
  views: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  source_id?: string;
  source_type?: string;
  created_at: string;
  updated_at: string;
  genres: Genre[];
  media_files: MediaFile[];
  trailers: MediaFile[];
  videos: MediaFile[];
}

const MediaFilesList = styled.div`
  margin-top: 20px;
`;

const MediaFileItem = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const MediaFileInfo = styled.div`
  flex: 1;
`;

const MediaFileTitle = styled.h4`
  margin: 0 0 5px 0;
  color: ${({ theme }) => theme.colors.text};
`;

const MediaFileType = styled.span`
  font-size: 0.9em;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const MediaFileActions = styled.div`
  display: flex;
  gap: 10px;
`;

const VideoPlayer = styled.video`
  width: 100%;
  max-width: 640px;
  margin-top: 10px;
  border-radius: 4px;
`;

const GenresList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
`;

const GenreTag = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 5px;

  button {
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.error};
    cursor: pointer;
    padding: 0;
    font-size: 1.2em;
    line-height: 1;
    display: flex;
    align-items: center;
  }
`;

const EditContent = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mediaItem, setMediaItem] = useState<MediaItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [availableGenres, setAvailableGenres] = useState<Genre[]>([]);
  const [newMediaFile, setNewMediaFile] = useState<{
    type: MediaFileType;
    title: string;
    url: string;
    episode_number?: number;
    season_number?: number;
  }>({
    type: 'TRAILER',
    title: '',
    url: '',
    episode_number: undefined,
    season_number: undefined
  });

  useEffect(() => {
    const checkAuthorization = async () => {
      if (!user) {
        await router.push('/auth/login');
        return;
      }

      if (user.role !== 'ADMIN') {
        await router.push('/');
        return;
      }

      setIsAuthorized(true);
    };

    checkAuthorization();
  }, [user, router]);

  useEffect(() => {
    if (isAuthorized && id) {
      fetchMediaItem();
      fetchAvailableGenres();
    }
  }, [isAuthorized, id]);

  useEffect(() => {
    if (mediaItem) {
      // Инициализируем массивы, если они не определены
      if (!mediaItem.media_files) mediaItem.media_files = [];
      if (!mediaItem.genres) mediaItem.genres = [];
      
      // Обновляем состояние
      setMediaItem({ ...mediaItem });
    }
  }, [mediaItem?.id]);

  useEffect(() => {
    if (mediaItem) {
      console.log('Loaded media item:', mediaItem);
      console.log('Media files:', mediaItem.media_files);
      console.log('Genres:', mediaItem.genres);
    }
  }, [mediaItem]);

  const fetchAvailableGenres = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Не найден токен авторизации');
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/admin/genres', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) throw new Error('Ошибка при загрузке жанров');

      const data = await response.json();
      setAvailableGenres(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Произошла ошибка при загрузке жанров');
    }
  };

  const fetchMediaItem = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Не найден токен авторизации');

      const response = await fetch(`/api/admin/content/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Контент не найден');
        }
        throw new Error('Ошибка при загрузке данных');
      }

      const data = await response.json();
      // Проверяем и инициализируем массивы, если они отсутствуют
      data.media_files = data.media_files || [];
      data.genres = data.genres || [];
      data.trailers = data.trailers || [];
      data.videos = data.videos || [];
      setMediaItem(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaItem) return;

    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Не найден токен авторизации');

      const response = await fetch(`/api/admin/content/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mediaItem),
      });

      if (!response.ok) {
        throw new Error('Ошибка при сохранении данных');
      }

      router.push('/admin/content');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Произошла ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthorized) {
    return null;
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <EditContainer>
          <div>Загрузка...</div>
        </EditContainer>
      </AdminLayout>
    );
  }

  if (!mediaItem) {
    return (
      <AdminLayout>
        <EditContainer>
          <div>Контент не найден</div>
        </EditContainer>
      </AdminLayout>
    );
  }

  const handleAddGenre = async () => {
    if (!selectedGenre || !mediaItem) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Не найден токен авторизации');

      const response = await fetch(`/api/admin/content/${id}/genres`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ genreId: parseInt(selectedGenre) }),
      });

      if (!response.ok) throw new Error('Ошибка при добавлении жанра');

      const updatedGenres = [...mediaItem.genres, availableGenres.find(g => g.id === parseInt(selectedGenre))!];
      setMediaItem({ ...mediaItem, genres: updatedGenres });
      setSelectedGenre('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Произошла ошибка');
    }
  };

  const handleRemoveGenre = async (genreId: number) => {
    if (!mediaItem) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Не найден токен авторизации');

      const response = await fetch(`/api/admin/content/${id}/genres/${genreId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Ошибка при удалении жанра');

      const updatedGenres = mediaItem.genres.filter(g => g.id !== genreId);
      setMediaItem({ ...mediaItem, genres: updatedGenres });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Произошла ошибка');
    }
  };

  const handleAddMediaFile = async () => {
    if (!mediaItem) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Не найден токен авторизации');

      const response = await fetch(`/api/admin/content/${id}/media-files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newMediaFile),
      });

      if (!response.ok) throw new Error('Ошибка при добавлении медиа-файла');

      const data = await response.json();
      setMediaItem({
        ...mediaItem,
        media_files: [...mediaItem.media_files, data],
      });

      setNewMediaFile({
        type: 'TRAILER',
        title: '',
        url: '',
        episode_number: undefined,
        season_number: undefined,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Произошла ошибка');
    }
  };

  const handleRemoveMediaFile = async (fileId: number) => {
    if (!mediaItem) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Не найден токен авторизации');

      const response = await fetch(`/api/admin/content/${id}/media-files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Ошибка при удалении медиа-файла');

      const updatedFiles = mediaItem.media_files.filter(f => f.id !== fileId);
      setMediaItem({ ...mediaItem, media_files: updatedFiles });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Произошла ошибка');
    }
  };

  return (
    <AdminLayout>
      <EditContainer>
        <h1>Редактирование контента</h1>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label>Название</Label>
            <Input
              type="text"
              value={mediaItem.title}
              onChange={(e) => setMediaItem({ ...mediaItem, title: e.target.value })}
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Оригинальное название</Label>
            <Input
              type="text"
              value={mediaItem.original_title || ''}
              onChange={(e) => setMediaItem({ ...mediaItem, original_title: e.target.value })}
            />
          </FormGroup>

          <FormGroup>
            <Label>Тип</Label>
            <Select
              value={mediaItem.type}
              onChange={(e) => setMediaItem({ ...mediaItem, type: e.target.value as 'MOVIE' | 'SERIES' })}
              required
            >
              <option value="MOVIE">Фильм</option>
              <option value="SERIES">Сериал</option>
            </Select>
          </FormGroup>

          <FormGroup>
            <Label>Описание</Label>
            <TextArea
              value={mediaItem.description || ''}
              onChange={(e) => setMediaItem({ ...mediaItem, description: e.target.value })}
            />
          </FormGroup>

          <FormGroup className="image-preview">
            <Label>URL постера</Label>
            <Input
              type="url"
              value={mediaItem.poster_url || ''}
              onChange={(e) => setMediaItem({ ...mediaItem, poster_url: e.target.value })}
            />
            {mediaItem.poster_url && (
              <div className="preview-container">
                <img src={mediaItem.poster_url} alt="Предпросмотр постера" />
              </div>
            )}
          </FormGroup>

          <FormGroup className="image-preview">
            <Label>URL фона</Label>
            <Input
              type="url"
              value={mediaItem.backdrop_url || ''}
              onChange={(e) => setMediaItem({ ...mediaItem, backdrop_url: e.target.value })}
            />
            {mediaItem.backdrop_url && (
              <div className="preview-container">
                <img src={mediaItem.backdrop_url} alt="Предпросмотр фона" />
              </div>
            )}
          </FormGroup>

          <FormGroup>
            <Label>Дата выхода</Label>
            <Input
              type="date"
              value={mediaItem.release_date?.split('T')[0] || ''}
              onChange={(e) => setMediaItem({ ...mediaItem, release_date: e.target.value })}
            />
          </FormGroup>

          <FormGroup>
            <Label>Рейтинг</Label>
            <Input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={mediaItem.rating}
              onChange={(e) => setMediaItem({ ...mediaItem, rating: parseFloat(e.target.value) })}
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Длительность (минуты)</Label>
            <Input
              type="number"
              min="0"
              value={mediaItem.duration || ''}
              onChange={(e) => setMediaItem({ ...mediaItem, duration: parseInt(e.target.value) })}
            />
          </FormGroup>

          <FormGroup>
            <Label>Статус</Label>
            <Select
              value={mediaItem.status}
              onChange={(e) => setMediaItem({ ...mediaItem, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'ERROR' })}
              required
            >
              <option value="ACTIVE">Активен</option>
              <option value="INACTIVE">Неактивен</option>
              <option value="ERROR">Ошибка</option>
            </Select>
          </FormGroup>

          <FormGroup>
            <Label>Жанры</Label>
            <GenresList>
              {mediaItem.genres?.map((genre) => (
                <GenreTag key={genre.id}>
                  {genre.name}
                  <button type="button" onClick={() => handleRemoveGenre(genre.id)}>&times;</button>
                </GenreTag>
              ))}
            </GenresList>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <Select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Выберите жанр</option>
                {availableGenres
                  .filter(genre => !mediaItem?.genres?.some(g => g.id === genre.id))
                  .map(genre => (
                    <option key={genre.id} value={genre.id}>{genre.name}</option>
                  ))}
              </Select>
              <Button type="button" onClick={handleAddGenre} disabled={!selectedGenre}>
                Добавить жанр
              </Button>
            </div>
          </FormGroup>

          <FormGroup>
            <Label>Трейлеры</Label>
            <MediaFilesList>
              {mediaItem?.trailers?.map((file) => (
                <MediaFileItem key={file.id}>
                  <MediaFileInfo>
                    <MediaFileTitle>
                      {file.title || 'Трейлер'}
                    </MediaFileTitle>
                    <MediaFileType>{file.type}</MediaFileType>
                  </MediaFileInfo>
                  <MediaFileActions>
                    <Button type="button" onClick={() => window.open(file.url, '_blank')}>Просмотр</Button>
                    <Button type="button" onClick={() => handleRemoveMediaFile(file.id)}>Удалить</Button>
                  </MediaFileActions>
                </MediaFileItem>
              ))}
            </MediaFilesList>
            <div style={{ marginTop: '20px' }}>
              <FormGroup>
                <Label>Добавить медиа-файл</Label>
                <Select
                  value={newMediaFile.type}
                  onChange={(e) => setNewMediaFile({ ...newMediaFile, type: e.target.value as 'TRAILER' | 'MOVIE' | 'EPISODE' })}
                >
                  <option value="TRAILER">Трейлер</option>
                  <option value="MOVIE">Фильм</option>
                  {mediaItem.type === 'SERIES' && <option value="EPISODE">Эпизод</option>}
                </Select>
              </FormGroup>
              {newMediaFile.type === 'EPISODE' && (
                <>
                  <FormGroup>
                    <Label>Номер сезона</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newMediaFile.season_number || ''}
                      onChange={(e) => setNewMediaFile({ ...newMediaFile, season_number: parseInt(e.target.value) })}
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label>Номер эпизода</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newMediaFile.episode_number || ''}
                      onChange={(e) => setNewMediaFile({ ...newMediaFile, episode_number: parseInt(e.target.value) })}
                    />
                  </FormGroup>
                </>
              )}
              <FormGroup>
                <Label>Название (необязательно)</Label>
                <Input
                  type="text"
                  value={newMediaFile.title}
                  onChange={(e) => setNewMediaFile({ ...newMediaFile, title: e.target.value })}
                />
              </FormGroup>
              <FormGroup>
                <Label>URL медиа-файла</Label>
                <Input
                  type="url"
                  value={newMediaFile.url}
                  onChange={(e) => setNewMediaFile({ ...newMediaFile, url: e.target.value })}
                />
              </FormGroup>
              <Button type="button" onClick={handleAddMediaFile} disabled={!newMediaFile.url}>
                Добавить медиа-файл
              </Button>
            </div>
          </FormGroup>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Form>
      </EditContainer>
    </AdminLayout>
  );
};

export default EditContent;
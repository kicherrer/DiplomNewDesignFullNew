import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { VideoType } from '@prisma/client';
import { YOUTUBE_API_KEY } from '@/config/youtube';

interface VideoSource {
  url: string;
  quality: string;
  type: VideoType;
  format: string;
  status?: 'loading' | 'ready' | 'error';
  errorMessage?: string;
  title?: string;
  description?: string;
}

interface VideoPlayerProps {
  videos: VideoSource[];
  trailers: VideoSource[];
  onQualityChange?: (quality: string) => void;
  onError?: (error: Error) => void;
  initialQuality?: string;
}

const PlayerContainer = styled.div`
  width: 100%;
  aspect-ratio: 16/9;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  position: relative;
`;

const VideoControls = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: ${({ theme }) => theme.spacing.md};
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  opacity: 0;
  transition: opacity 0.3s ease;

  ${PlayerContainer}:hover & {
    opacity: 1;
  }
`;

const QualitySelector = styled.select`
  background: rgba(0, 0, 0, 0.5);
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.sm};
  cursor: pointer;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
`;

const VideoTypeSwitch = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const TypeButton = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme, $active }) => $active ? theme.colors.primary : 'transparent'};
  color: ${({ theme, $active }) => $active ? theme.colors.text : theme.colors.textSecondary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme, $active }) => $active ? theme.colors.primary : theme.colors.surface};
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`;

const ErrorMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: ${({ theme }) => theme.colors.error};
  text-align: center;
  padding: ${({ theme }) => theme.spacing.lg};
  background: rgba(0, 0, 0, 0.8);
  border-radius: ${({ theme }) => theme.borderRadius.md};
`;

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videos, trailers, onError, initialQuality = 'auto' }) => {
  const [currentType, setCurrentType] = useState<'movie' | 'trailer'>('movie');
  const [currentQuality, setCurrentQuality] = useState<string>(initialQuality);
  const [currentSource, setCurrentSource] = useState<string>('');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const maxRetries = 3;
  const [validatedTrailers, setValidatedTrailers] = useState<VideoSource[]>([]);

  const currentVideos = currentType === 'movie' ? videos : trailers;

  const getYouTubeEmbedUrl = (url: string): string => {
    const videoId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^\/\?&]+)/)?.[1];
    if (!videoId) return url;
    
    const params = new URLSearchParams({
      origin: window.location.origin,
      enablejsapi: '1',
      autoplay: '0',
      modestbranding: '1',
      rel: '0',
      controls: '1',
      nocookie: '1',
      iv_load_policy: '3',
      referrer: window.location.origin,
      cors: '1'
    });

    // Добавляем API ключ через заголовки для большей безопасности
    const headers = new Headers({
      'Authorization': `Bearer ${YOUTUBE_API_KEY}`,
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': window.location.origin
    });

    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  };

  const validateTrailer = (trailer: VideoSource, mediaTitle: string, mediaDescription: string): boolean => {
    if (!trailer.title || !trailer.description) return false;
    
    const trailerKeywords = [...trailer.title.toLowerCase().split(' '), ...trailer.description.toLowerCase().split(' ')];
    const mediaKeywords = [...mediaTitle.toLowerCase().split(' '), ...mediaDescription.toLowerCase().split(' ')];
    
    const matchCount = trailerKeywords.filter(keyword => 
      mediaKeywords.some(mediaWord => mediaWord.includes(keyword) || keyword.includes(mediaWord))
    ).length;
    
    const threshold = Math.min(trailerKeywords.length, mediaKeywords.length) * 0.3;
    return matchCount >= threshold;
  };

  const findMatchingTrailer = (mediaTitle: string, mediaDescription: string): VideoSource | null => {
    const matchingTrailer = trailers.find(trailer => validateTrailer(trailer, mediaTitle, mediaDescription));
    return matchingTrailer || null;
  };

  const handleVideoError = async () => {
    if (retryCount < maxRetries) {
      setIsLoading(true);
      setError('');
      try {
        const retryDelay = Math.min(500 * Math.pow(1.5, retryCount), 2000);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        setRetryCount(prev => prev + 1);
        
        if (currentType === 'trailer' && currentSource) {
          // Проверяем валидность URL и соответствие трейлера
          try {
            const currentVideo = videos[0];
            if (currentVideo && currentVideo.title && currentVideo.description) {
              const matchingTrailer = findMatchingTrailer(currentVideo.title, currentVideo.description);
              if (matchingTrailer && matchingTrailer.url !== currentSource) {
                console.log('Найден более подходящий трейлер, выполняем замену...');
                setCurrentSource(getYouTubeEmbedUrl(matchingTrailer.url));
                return;
              }
            }

            const response = await fetch(currentSource, { method: 'HEAD' });
            if (!response.ok) {
              throw new Error('Трейлер недоступен или был удален');
            }
            
            const newUrl = new URL(currentSource);
            newUrl.searchParams.set('_retry', retryCount.toString());
            newUrl.searchParams.set('t', Date.now().toString());
            newUrl.searchParams.set('cors', '1');
            setCurrentSource(newUrl.toString());
            
            // Обновляем iframe с проверенным URL
            const iframe = document.querySelector('iframe');
            if (iframe) {
              iframe.src = newUrl.toString();
            }
          } catch (urlError) {
            console.error('Ошибка при проверке URL трейлера:', urlError);
            throw new Error('Трейлер недоступен. Пожалуйста, сообщите администратору.');
          }
        }
      } catch (err: unknown) {
        console.error('Ошибка при загрузке трейлера:', err);
        const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
        setError(errorMessage);
        onError && onError(new Error(`Ошибка загрузки трейлера: ${errorMessage}`));
      } finally {
        setIsLoading(false);
      }
    } else {
      const errorMessage = 'Не удалось загрузить трейлер. Возможно, он был удален или перемещен.';
      setError(errorMessage);
      onError && onError(new Error(errorMessage));
    }
  };

  useEffect(() => {
    const initializeVideo = async () => {
      try {
        setIsLoading(true);
        setError('');

        if (videos.length === 0 && trailers.length > 0) {
          setCurrentType('trailer');
        }

        if (currentVideos.length > 0) {
          const defaultVideo = currentVideos.sort((a, b) => {
            const qualityOrder: Record<string, number> = { '1080p': 3, '720p': 2, '480p': 1, '360p': 0 };
            return (qualityOrder[b.quality] ?? -1) - (qualityOrder[a.quality] ?? -1);
          })[0];

          setCurrentQuality(defaultVideo.quality);
          
          if (currentType === 'trailer') {
            setCurrentSource(getYouTubeEmbedUrl(defaultVideo.url));
          } else {
            setCurrentSource(defaultVideo.url);
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
        setError('Ошибка при инициализации видео');
        onError && onError(new Error(`Ошибка при инициализации видео: ${errorMessage}`));
      } finally {
        setIsLoading(false);
      }
    };

    initializeVideo();
  }, [currentVideos, currentType, videos.length, trailers.length]);

  const handleQualityChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      setIsLoading(true);
      setError('');
      const newQuality = event.target.value;
      const newSource = currentVideos.find(v => v.quality === newQuality);
      
      if (newSource) {
        setCurrentQuality(newQuality);
        if (currentType === 'trailer') {
          setCurrentSource(getYouTubeEmbedUrl(newSource.url));
        } else {
          setCurrentSource(newSource.url);
        }
      } else {
        throw new Error('Не удалось найти источник видео для выбранного качества');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(errorMessage);
      onError && onError(new Error(`Ошибка при смене качества видео: ${errorMessage}`));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = async (type: 'movie' | 'trailer') => {
    try {
      setIsLoading(true);
      setError('');
      setCurrentType(type);
      
      const videoList = type === 'movie' ? videos : trailers;
      if (videoList.length > 0) {
        const defaultVideo = videoList[0];
        setCurrentQuality(defaultVideo.quality);
        setCurrentSource(type === 'trailer' ? getYouTubeEmbedUrl(defaultVideo.url) : defaultVideo.url);
      } else {
        throw new Error(`Нет доступных ${type === 'movie' ? 'фильмов' : 'трейлеров'}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(errorMessage);
      onError && onError(new Error(`Ошибка при смене типа видео: ${errorMessage}`));
    } finally {
      setIsLoading(false);
    }
  };

  if (!videos.length && !trailers.length) {
    return (
      <PlayerContainer>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Видео контент недоступен
        </div>
      </PlayerContainer>
    );
  }

  return (
    <div>
      <VideoTypeSwitch>
        {videos.length > 0 && (
          <TypeButton
            $active={currentType === 'movie'}
            onClick={() => handleTypeChange('movie')}
          >
            Фильм
          </TypeButton>
        )}
        {trailers.length > 0 && (
          <TypeButton
            $active={currentType === 'trailer'}
            onClick={() => handleTypeChange('trailer')}
          >
            Трейлер
          </TypeButton>
        )}
      </VideoTypeSwitch>

      <PlayerContainer>
        {isLoading && (
          <LoadingOverlay>
            Загрузка видео... Попытка {retryCount + 1} из {maxRetries}
          </LoadingOverlay>
        )}
        {error && (
          <ErrorMessage>{error}</ErrorMessage>
        )}
        {currentSource && !error && (
          currentType === 'trailer' ? (
            <iframe
              width="100%"
              height="100%"
              src={currentSource}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onError={() => handleVideoError()}
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video
              controls
              autoPlay={false}
              style={{ width: '100%', height: '100%' }}
            >
              <source src={currentSource} type="video/mp4" />
              Ваш браузер не поддерживает видео
            </video>
          )
        )}

        <VideoControls>
          {currentVideos.length > 1 && (
            <QualitySelector
              value={currentQuality}
              onChange={handleQualityChange}
            >
              {currentVideos.map((video) => (
                <option key={video.quality} value={video.quality}>
                  {video.quality}
                </option>
              ))}
            </QualitySelector>
          )}
        </VideoControls>
      </PlayerContainer>
    </div>
  );
};

export default VideoPlayer;
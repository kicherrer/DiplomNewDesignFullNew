import React, { useState, useEffect } from 'react';
import styled, { DefaultTheme } from 'styled-components';
import Layout from '../../components/Layout/Layout';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { FiFilter, FiChevronDown } from 'react-icons/fi';
import { useRouter } from 'next/router';

interface Movie {
  id: number;
  title: string;
  image: string;
  year: string;
  rating: number;
  poster_url?: string;
  poster_path?: string;
  release_date: string;
}

interface FilterState {
  genre: string[];
  year: string;
  rating: string;
  sort: string;
}

const CatalogContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
  position: relative;
`;

const FilterPanel = styled(motion.div)<HTMLMotionProps<"div">>`
  width: 280px;
  background: ${({ theme }) => theme.colors.background};
  padding: ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.md};
  position: sticky;
  top: 100px;
  height: fit-content;
`;

const FilterSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const FilterTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
`;

const ContentGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

const MovieCard = styled(motion.a)<HTMLMotionProps<"a">>`
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  cursor: pointer;
  box-shadow: ${({ theme }) => theme.shadows.md};
  text-decoration: none;
  color: inherit;
  display: block;
`;

const MovieImage = styled(motion.img)<HTMLMotionProps<"img">>`
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
  background: ${({ theme }) => theme.colors.surface};
`;

const MovieInfo = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
`;

const MovieTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.lg} 0;
`;

const PageButton = styled.button<{ disabled?: boolean; theme: DefaultTheme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PageNumber = styled.button<{ $active?: boolean; theme: DefaultTheme }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.surface};
  color: ${({ $active, theme }) => $active ? theme.colors.text : theme.colors.textSecondary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
`;

const TabsContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  overflow-x: auto;
  padding-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Tab = styled.button<{ $active?: boolean; theme: DefaultTheme }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  background: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.surface};
  color: ${({ $active, theme }) => $active ? 'white' : theme.colors.text};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.surfaceHover};
  }
`;

const LoadingOverlay = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
`;

const ErrorMessage = styled(motion.div)`
  text-align: center;
  color: ${({ theme }) => theme.colors.error};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  margin: ${({ theme }) => theme.spacing.xl} 0;
`;

const MovieMeta = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  display: flex;
  justify-content: space-between;
`;

const Checkbox = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const CatalogPage: React.FC = () => {
  const router = useRouter();
  const itemsPerPage = 40;
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedMovies, setCachedMovies] = useState<Record<number, Movie[]>>({});
  const [visibleTabs, setVisibleTabs] = useState<number[]>([1]);
  const [activeTab, setActiveTab] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    genre: [],
    year: '',
    rating: '',
    sort: 'popularity'
  });

  useEffect(() => {
    let isMounted = true;
    let currentController: AbortController | null = null;

    const fetchMovies = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);

      try {
        if (cachedMovies[currentPage] && !filters.genre.length) {
          setMovies(cachedMovies[currentPage]);
          setIsLoading(false);
          return;
        }

        // Отменяем предыдущий запрос, если он есть
        if (currentController) {
          currentController.abort();
        }

        // Создаем новый контроллер для текущего запроса
        currentController = new AbortController();

        const response = await fetch('/api/movies/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-store'
          },
          body: JSON.stringify({
            filters: filters,
            page: currentPage,
            limit: itemsPerPage
          }),
          signal: currentController.signal
        });

        if (!response.ok) {
          throw new Error('Не удалось загрузить фильмы');
        }

        const data = await response.json();
        if (!isMounted) return;

        const newMovies = data.items || [];
        const total = Math.ceil(data.total / itemsPerPage);
        
        setCachedMovies(prev => ({
          ...prev,
          [currentPage]: newMovies
        }));

        setMovies(newMovies);
        setTotalPages(total);

        if (!visibleTabs.includes(currentPage)) {
          setVisibleTabs(prev => [...prev, currentPage].sort((a, b) => a - b));
        }
      } catch (error) {
        if (!isMounted) return;
        if (error instanceof Error && error.name === 'AbortError') {
          // Игнорируем ошибки отмены запроса
          return;
        }
        setError(error instanceof Error ? error.message : 'Произошла ошибка при загрузке фильмов');
        console.error('Error fetching movies:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMovies();

    return () => {
      isMounted = false;
      if (currentController) {
        currentController.abort();
      }
    };
  }, [currentPage, filters]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setActiveTab(newPage);
    if (!visibleTabs.includes(newPage)) {
      setVisibleTabs(prev => [...prev, newPage].sort((a, b) => a - b));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
    setCachedMovies({});
  };

  useEffect(() => {
    let isMounted = true;
    let currentController: AbortController | null = null;

    const fetchMovies = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);

      try {
        if (cachedMovies[currentPage] && !filters.genre.length) {
          setMovies(cachedMovies[currentPage]);
          setIsLoading(false);
          return;
        }

        if (currentController) {
          currentController.abort();
        }

        currentController = new AbortController();

        const response = await fetch(`/api/media?page=${currentPage}&limit=${itemsPerPage}${filters.genre.length ? `&genre=${filters.genre.join(',')}` : ''}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-store'
          },
          signal: currentController.signal
        });

        if (!response.ok) {
          throw new Error('Не удалось загрузить фильмы');
        }

        const data = await response.json();
        if (!isMounted) return;

        const newMovies = data.items || [];
        const total = Math.ceil(data.total / itemsPerPage);
        
        setCachedMovies(prev => ({
          ...prev,
          [currentPage]: newMovies
        }));

        setMovies(newMovies);
        setTotalPages(total);

        if (!visibleTabs.includes(currentPage)) {
          setVisibleTabs(prev => [...prev, currentPage].sort((a, b) => a - b));
        }
      } catch (error) {
        if (!isMounted) return;
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setError(error instanceof Error ? error.message : 'Произошла ошибка при загрузке фильмов');
        console.error('Error fetching movies:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMovies();

    return () => {
      isMounted = false;
      if (currentController) {
        currentController.abort();
      }
    };
  }, [currentPage, filters]);
  const [genres, setGenres] = useState<string[]>([]);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch('/api/movies/genres', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setGenres(data);
        }
      } catch (error) {
        console.error('Error fetching genres:', error);
      }
    };
    fetchGenres();
  }, []);

  return (
    <Layout>
      <CatalogContainer>
        <FilterPanel
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <FilterSection>
            <FilterTitle>
              Жанры <FiChevronDown />
            </FilterTitle>
            {genres.map((genre) => (
              <Checkbox key={genre}>
                <input
                  type="checkbox"
                  checked={filters.genre.includes(genre)}
                  onChange={(e) => {
                    const newGenres = e.target.checked
                      ? [...filters.genre, genre]
                      : filters.genre.filter((g) => g !== genre);
                    setFilters({ ...filters, genre: newGenres });
                  }}
                />
                {genre}
              </Checkbox>
            ))}
          </FilterSection>

          <FilterSection>
            <FilterTitle>
              Год выпуска <FiChevronDown />
            </FilterTitle>
            {/* Add year range slider or select here */}
          </FilterSection>

          <FilterSection>
            <FilterTitle>
              Рейтинг <FiChevronDown />
            </FilterTitle>
            {/* Add rating filter controls here */}
          </FilterSection>
        </FilterPanel>

        <div style={{ flex: 1 }}>
          <TabsContainer>
            {visibleTabs.map(tab => (
              <Tab
                key={tab}
                $active={activeTab === tab}
                onClick={() => handlePageChange(tab)}
              >
                Страница {tab}
              </Tab>
            ))}
          </TabsContainer>

          {error && (
            <ErrorMessage
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {error}
            </ErrorMessage>
          )}

          <ContentGrid style={{ position: 'relative' }}>
            {isLoading && (
              <LoadingOverlay
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 40, height: 40, border: '4px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }}
                />
              </LoadingOverlay>
            )}
            <AnimatePresence>
              {movies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  href={`/watch/${movie.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(`/watch/${movie.id}`);
                  }}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  <MovieImage
                    src={movie.poster_url || movie.poster_path || `/api/movies/${movie.id}/poster`}
                    alt={movie.title}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/default-poster.svg';
                      target.onerror = null;
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                  <MovieInfo>
                    <MovieTitle>{movie.title}</MovieTitle>
                    <MovieMeta>
                      <span>{new Date(movie.release_date).getFullYear()}</span>
                      <span>★ {movie.rating.toFixed(1)}</span>
                    </MovieMeta>
                  </MovieInfo>
                </MovieCard>
              ))}
            </AnimatePresence>
          </ContentGrid>

          {totalPages > 1 && (
            <Pagination>
              <PageButton
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Назад
              </PageButton>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <PageNumber
                  key={page}
                  $active={page === currentPage}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </PageNumber>
              ))}
              <PageButton
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Вперед
              </PageButton>
            </Pagination>
          )}
        </div>
      </CatalogContainer>
    </Layout>
  );
};

export default CatalogPage;
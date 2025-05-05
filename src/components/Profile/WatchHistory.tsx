import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCalendar, FiClock, FiFilter, FiStar } from 'react-icons/fi';

const HistoryContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
`;

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
`;

const FilterButton = styled(motion.button)<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};
  color: ${({ $active, theme }) =>
    $active ? 'white' : theme.colors.textSecondary};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.surface};
  }
`;

const HistoryList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

const HistoryCard = styled(motion.div)`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.md};
`;

const CardImage = styled.img`
  width: 100%;
  height: 160px;
  object-fit: cover;
`;

const CardContent = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
`;

const CardTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  svg {
    font-size: 16px;
  }
`;

const Rating = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.colors.warning};
`;

interface WatchHistoryItem {
  id: string;
  title: string;
  image: string;
  watchDate: string;
  duration: string;
  rating: number;
}

const WatchHistory: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'rating'>('date');

  // Пример данных
  const historyItems: WatchHistoryItem[] = [
    {
      id: '1',
      title: 'Inception',
      image: 'https://via.placeholder.com/300x160',
      watchDate: '2024-01-15',
      duration: '2h 28m',
      rating: 4.8
    },
    // Добавьте больше элементов истории здесь
  ];

  const filterItems = (items: WatchHistoryItem[]) => {
    let filtered = [...items];
    const now = new Date();

    if (filter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(item => new Date(item.watchDate) >= weekAgo);
    } else if (filter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(item => new Date(item.watchDate) >= monthAgo);
    }

    return filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.watchDate).getTime() - new Date(a.watchDate).getTime();
      } else {
        return b.rating - a.rating;
      }
    });
  };

  return (
    <HistoryContainer>
      <FilterBar>
        <FilterButton
          $active={filter === 'all'}
          onClick={() => setFilter('all')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiFilter />
          Все
        </FilterButton>
        <FilterButton
          $active={filter === 'week'}
          onClick={() => setFilter('week')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiCalendar />
          За неделю
        </FilterButton>
        <FilterButton
          $active={filter === 'month'}
          onClick={() => setFilter('month')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiCalendar />
          За месяц
        </FilterButton>
        <FilterButton
          $active={sortBy === 'date'}
          onClick={() => setSortBy('date')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiClock />
          По дате
        </FilterButton>
        <FilterButton
          $active={sortBy === 'rating'}
          onClick={() => setSortBy('rating')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiStar />
          По рейтингу
        </FilterButton>
      </FilterBar>

      <AnimatePresence>
        <HistoryList>
          {filterItems(historyItems).map((item) => (
            <HistoryCard
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <CardImage src={item.image} alt={item.title} />
              <CardContent>
                <CardTitle>{item.title}</CardTitle>
                <CardMeta>
                  <span>
                    <FiCalendar />
                    {new Date(item.watchDate).toLocaleDateString()}
                  </span>
                  <span>
                    <FiClock />
                    {item.duration}
                  </span>
                  <Rating>
                    <FiStar />
                    {item.rating}
                  </Rating>
                </CardMeta>
              </CardContent>
            </HistoryCard>
          ))}
        </HistoryList>
      </AnimatePresence>
    </HistoryContainer>
  );
};

export default WatchHistory;
import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiPlay, FiClock } from 'react-icons/fi';

const HistoryContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

const MediaCard = styled(motion.div)`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  position: relative;
`;

const MediaImage = styled.img`
  width: 100%;
  height: 150px;
  object-fit: cover;
`;

const MediaInfo = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
`;

const MediaTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.text};
`;

const ViewInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const ActionButton = styled(motion.button)`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  &:hover {
    background: ${({ theme }) => theme.colors.primaryDark};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ViewDate = styled.span`
  position: absolute;
  top: ${({ theme }) => theme.spacing.md};
  right: ${({ theme }) => theme.spacing.md};
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

interface HistoryItem {
  id: number;
  title: string;
  image_url: string;
  viewed_at: string;
  watch_duration: number;
}

interface HistoryProps {
  items: HistoryItem[];
  onRewatch: (id: number) => void;
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} ч ${remainingMinutes} мин`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const History: React.FC<HistoryProps> = ({ items, onRewatch }) => {
  if (items.length === 0) {
    return (
      <EmptyState>
        <h3>История просмотров пуста</h3>
        <p>Начните смотреть контент</p>
      </EmptyState>
    );
  }

  return (
    <HistoryContainer>
      {items.map((item) => (
        <MediaCard
          key={item.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <MediaImage src={item.image_url} alt={item.title} />
          <ViewDate>
            <FiClock size={14} />
            {formatDate(item.viewed_at)}
          </ViewDate>
          <MediaInfo>
            <MediaTitle>{item.title}</MediaTitle>
            <ViewInfo>
              <FiClock size={14} />
              {formatDuration(item.watch_duration)}
            </ViewInfo>
            <ActionButton
              onClick={() => onRewatch(item.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiPlay size={16} />
              Пересмотреть
            </ActionButton>
          </MediaInfo>
        </MediaCard>
      ))}
    </HistoryContainer>
  );
};

export default History;
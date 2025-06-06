import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiTrash2, FiPlay, FiHeart } from 'react-icons/fi';

const FavoritesContainer = styled.div`
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

const MediaDescription = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
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

const FavoriteIcon = styled(FiHeart)`
  position: absolute;
  top: ${({ theme }) => theme.spacing.md};
  right: ${({ theme }) => theme.spacing.md};
  color: #ff4757;
  background: rgba(255, 255, 255, 0.8);
  padding: 5px;
  border-radius: 50%;
  font-size: 1.5rem;
`;

interface FavoriteItem {
  id: number;
  title: string;
  description: string;
  image_url: string;
  added_at: string;
}

interface FavoritesProps {
  items: FavoriteItem[];
  onRemove: (id: number) => void;
  onWatch: (id: number) => void;
}

const Favorites: React.FC<FavoritesProps> = ({ items, onRemove, onWatch }) => {
  if (items.length === 0) {
    return (
      <EmptyState>
        <h3>Список избранного пуст</h3>
        <p>Добавьте контент в избранное</p>
      </EmptyState>
    );
  }

  return (
    <FavoritesContainer>
      {items.map((item) => (
        <MediaCard
          key={item.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <MediaImage src={item.image_url} alt={item.title} />
          <FavoriteIcon />
          <MediaInfo>
            <MediaTitle>{item.title}</MediaTitle>
            <MediaDescription>{item.description}</MediaDescription>
            <ActionButtons>
              <ActionButton
                onClick={() => onWatch(item.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FiPlay size={16} />
                Смотреть
              </ActionButton>
              <ActionButton
                onClick={() => onRemove(item.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ background: '#dc3545' }}
              >
                <FiTrash2 size={16} />
                Удалить из избранного
              </ActionButton>
            </ActionButtons>
          </MediaInfo>
        </MediaCard>
      ))}
    </FavoritesContainer>
  );
};

export default Favorites;
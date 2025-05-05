import React, { useState } from 'react';
import styled from 'styled-components';
import Layout from '../../components/Layout/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { FiThumbsUp, FiThumbsDown, FiBookmark } from 'react-icons/fi';

const PageContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.xl} 0;
`;

const SectionTitle = styled(motion.h2)`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.text};
`;

const CarouselContainer = styled.div`
  position: relative;
  margin-bottom: ${({ theme }) => theme.spacing['2xl']};
`;

const CarouselTrack = styled(motion.div)`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} 0;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const MovieCard = styled(motion.div)`
  flex: 0 0 300px;
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.lg};
`;

const MovieImage = styled.img`
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
`;

const MovieContent = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
`;

const MovieTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const MovieDescription = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
`;

const ActionButton = styled(motion.button)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textSecondary};
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    color: white;
  }
`;

const RecommendationsPage: React.FC = () => {
  const [recommendations] = useState([
    {
      id: 1,
      title: 'Интерстеллар',
      description: 'Фантастическое путешествие через червоточину в поисках нового дома для человечества.',
      image: 'https://via.placeholder.com/300x169',
      match: 98
    },
    {
      id: 2,
      title: 'Начало',
      description: 'Искусный вор, специализирующийся на извлечении ценных секретов из глубин подсознания во время сна.',
      image: 'https://via.placeholder.com/300x169',
      match: 95
    },
    // Add more recommendations
  ]);

  return (
    <Layout>
      <PageContainer>
        <SectionTitle
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Персональные рекомендации
        </SectionTitle>

        <CarouselContainer>
          <CarouselTrack
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {recommendations.map((movie) => (
              <MovieCard
                key={movie.id}
                whileHover={{ y: -5 }}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <MovieImage src={movie.image} alt={movie.title} />
                <MovieContent>
                  <MovieTitle>{movie.title}</MovieTitle>
                  <MovieDescription>{movie.description}</MovieDescription>
                  <ActionButtons>
                    <ActionButton
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05 }}
                    >
                      <FiThumbsUp /> Нравится
                    </ActionButton>
                    <ActionButton
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05 }}
                    >
                      <FiThumbsDown /> Не интересно
                    </ActionButton>
                    <ActionButton
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05 }}
                    >
                      <FiBookmark /> Сохранить
                    </ActionButton>
                  </ActionButtons>
                </MovieContent>
              </MovieCard>
            ))}
          </CarouselTrack>
        </CarouselContainer>
      </PageContainer>
    </Layout>
  );
};

export default RecommendationsPage;
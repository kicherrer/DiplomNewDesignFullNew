import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiEye, FiHeart, FiBookmark } from 'react-icons/fi';

const StatsContainer = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  margin: ${({ theme }) => theme.spacing.xl} 0;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const StatCard = styled(motion.div)`
  padding: ${({ theme }) => theme.spacing.lg};
  background: linear-gradient(145deg, ${({ theme }) => `${theme.colors.background}05`}, ${({ theme }) => `${theme.colors.background}15`});
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(5px);

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
    background: linear-gradient(145deg, ${({ theme }) => `${theme.colors.background}10`}, ${({ theme }) => `${theme.colors.background}20`});
  }
`;

const IconWrapper = styled(motion.div)`
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: ${({ theme }) => `${theme.colors.primary}15`};
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  font-size: 28px;
  box-shadow: 0 4px 15px ${({ theme }) => `${theme.colors.primary}30`};
  border: 2px solid ${({ theme }) => `${theme.colors.primary}30`};
`;

const StatValue = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const StatLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 1px;
`;

interface UserStatsProps {
  viewsCount: number;
  favoritesCount: number;
  watchlistCount: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 20 } }
};

const iconVariants = {
  hover: { scale: 1.2, rotate: 15, transition: { type: "spring", stiffness: 500, damping: 10 } }
};

const UserStats: React.FC<UserStatsProps> = ({ viewsCount, favoritesCount, watchlistCount }) => {
  return (
    <StatsContainer
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.1
          }
        }
      }}
    >
      <StatCard variants={cardVariants}>
        <IconWrapper whileHover="hover" variants={iconVariants}>
          <FiEye />
        </IconWrapper>
        <StatValue>{viewsCount.toLocaleString()}</StatValue>
        <StatLabel>Просмотры</StatLabel>
      </StatCard>

      <StatCard variants={cardVariants}>
        <IconWrapper whileHover="hover" variants={iconVariants}>
          <FiHeart />
        </IconWrapper>
        <StatValue>{favoritesCount.toLocaleString()}</StatValue>
        <StatLabel>В избранном</StatLabel>
      </StatCard>

      <StatCard variants={cardVariants}>
        <IconWrapper whileHover="hover" variants={iconVariants}>
          <FiBookmark />
        </IconWrapper>
        <StatValue>{watchlistCount.toLocaleString()}</StatValue>
        <StatLabel>Смотреть позже</StatLabel>
      </StatCard>
    </StatsContainer>
  );
};

export default UserStats;
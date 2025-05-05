import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiSearch } from 'react-icons/fi';

const HeaderContainer = styled.header`
  background: ${({ theme }) => theme.colors.background};
  padding: 1.5rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 90;
  margin-left: 280px;
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 12px;
  padding: 0.5rem 1rem;
  width: 300px;
  gap: 0.5rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  transition: all 0.3s ease;

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => `${theme.colors.primary}22`};
  }

  svg {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const SearchInput = styled.input`
  border: none;
  background: none;
  outline: none;
  width: 100%;
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.9rem;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
`;



const StatsContainer = styled.div`
  display: flex;
  gap: 1.5rem;
`;

const StatItem = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const StatLabel = styled.span`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const StatValue = styled.span`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

interface AdminHeaderProps {
  onSearch?: (query: string) => void;
  stats?: {
    totalUsers?: number;
    activeUsers?: number;
    newContent?: number;
  };
  currentPath: string;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ onSearch, stats, currentPath }) => {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <HeaderContainer>
        {currentPath === '/admin/users' && (
          <SearchBar>
            <FiSearch />
            <SearchInput
              placeholder="Поиск по ID, email или никнейму..."
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </SearchBar>
        )}

        <RightSection>
          {currentPath === '/admin/users' && (
            <StatsContainer>
              <StatItem>
                <StatLabel>Всего пользователей</StatLabel>
                <StatValue>{stats?.totalUsers || 0}</StatValue>
              </StatItem>
              <StatItem>
                <StatLabel>Активных сегодня</StatLabel>
                <StatValue>{stats?.activeUsers || 0}</StatValue>
              </StatItem>
            </StatsContainer>
          )}
          {currentPath === '/admin/content' && (
            <StatsContainer>
              <StatItem>
                <StatLabel>Новый контент</StatLabel>
                <StatValue>{stats?.newContent || 0}</StatValue>
              </StatItem>
            </StatsContainer>
          )}


        </RightSection>
      </HeaderContainer>
    </motion.div>
  );
};

export default AdminHeader;
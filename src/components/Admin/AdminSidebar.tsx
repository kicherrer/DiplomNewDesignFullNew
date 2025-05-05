import React from 'react';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiHome, FiSettings, FiUsers, FiDatabase, FiLogOut } from 'react-icons/fi';

const SidebarContainer = styled(motion.div)`
  width: 280px;
  background: linear-gradient(180deg, ${({ theme }) => theme.colors.primary} 0%, ${({ theme }) => `${theme.colors.primary}dd`} 100%);
  padding: 2rem 1.5rem;
  color: white;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 10px rgba(0, 0, 0, 0.1);
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
  z-index: 100;
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 2.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const NavGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 2rem;
`;

const NavItem = styled(motion.div)<{ $active?: boolean }>`
  padding: 0.875rem 1rem;
  border-radius: 12px;
  cursor: pointer;
  background-color: ${({ $active }) =>
    $active ? 'rgba(255, 255, 255, 0.15)' : 'transparent'};
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: ${({ $active }) => ($active ? '600' : '400')};
  transition: all 0.3s ease;

  svg {
    font-size: 1.25rem;
    opacity: ${({ $active }) => ($active ? '1' : '0.8')};
  }

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: translateX(5px);
  }
`;

const LogoutButton = styled(motion.button)`
  margin-top: auto;
  padding: 0.875rem 1rem;
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.15);
    transform: translateX(5px);
  }

  svg {
    font-size: 1.25rem;
  }
`;

interface AdminSidebarProps {
  onLogout: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ onLogout }) => {
  const router = useRouter();
  const currentPath = router.pathname;

  const navigationItems = [
    { title: 'Обзор', path: '/admin', icon: <FiHome /> },
    { title: 'Пользователи', path: '/admin/users', icon: <FiUsers /> },
    { title: 'Парсер', path: '/admin/parser', icon: <FiDatabase /> },
    { title: 'Настройки', path: '/admin/settings', icon: <FiSettings /> },
  ];

  return (
    <SidebarContainer
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', stiffness: 100 }}
    >
      <Logo>
        <FiDatabase /> Админ панель
      </Logo>
      <NavGroup>
        {navigationItems.map((item) => (
          <NavItem
            key={item.path}
            $active={currentPath === item.path}
            onClick={() => router.push(item.path)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {item.icon}
            {item.title}
          </NavItem>
        ))}
      </NavGroup>
      <LogoutButton
        onClick={onLogout}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <FiLogOut />
        Выйти
      </LogoutButton>
    </SidebarContainer>
  );
};

export default AdminSidebar;
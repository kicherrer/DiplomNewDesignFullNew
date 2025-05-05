import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Layout from '../../components/Layout/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileSettings from './ProfileSettings';
import WatchHistory from './WatchHistory';
import Favorites from './Favorites';
import { FiEdit2, FiSettings, FiList, FiHeart, FiClock, FiUpload } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { uploadAvatar } from '../../utils/avatar';

const ProfileContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  background: linear-gradient(to bottom right, ${({ theme }) => theme.colors.background}, ${({ theme }) => `${theme.colors.background}dd`});
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const ProfileHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.lg};
  background: linear-gradient(135deg, 
    ${({ theme }) => `${theme.colors.primary}10`}, 
    ${({ theme }) => `${theme.colors.primary}20`}
  );
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
  
  @media (min-width: 768px) {
    grid-template-columns: auto 1fr;
    align-items: start;
    text-align: left;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      45deg,
      transparent 0%,
      rgba(255, 255, 255, 0.05) 50%,
      transparent 100%
    );
    transform: translateX(-100%);
    transition: transform 0.5s ease;
  }

  &:hover::before {
    transform: translateX(100%);
  }
`;

const Avatar = styled(motion.div)`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  border: 4px solid ${({ theme }) => theme.colors.background};
  transition: all 0.3s ease;
  margin: 0 auto;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    border-color: ${({ theme }) => theme.colors.primary};
    
    &::after {
      content: 'Изменить фото';
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.4));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 1.1em;
      opacity: 1;
    }
  }

  input[type="file"] {
    display: none;
  }
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ProfileInfo = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => `${theme.colors.background}80`};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  backdrop-filter: blur(8px);
  
  @media (min-width: 768px) {
    align-items: flex-start;
    text-align: left;
  }
`;

const Username = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const EditButton = styled(motion.button)`
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary}, ${({ theme }) => `${theme.colors.primary}dd`});
  border: none;
  color: white;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  box-shadow: 0 2px 8px ${({ theme }) => `${theme.colors.primary}44`};
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.lg} 0;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => `${theme.colors.surface}90`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  backdrop-filter: blur(8px);
  width: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  
  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const StatItem = styled(motion.div)`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => `${theme.colors.background}33`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  min-width: 100px;
  transition: transform 0.3s ease, background 0.3s ease;

  &:hover {
    background: ${({ theme }) => `${theme.colors.background}66`};
    transform: translateY(-5px);
  }

  span {
    display: block;
    &:first-child {
      font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      color: ${({ theme }) => theme.colors.primary};
      margin-bottom: ${({ theme }) => theme.spacing.xs};
    }
    &:last-child {
      color: ${({ theme }) => theme.colors.textSecondary};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
`;

const TabsContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const TabList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  border-bottom: 2px solid ${({ theme }) => theme.colors.surface};
  background: ${({ theme }) => `${theme.colors.surface}40`};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.md};
  margin: 0 -${({ theme }) => theme.spacing.md};
  
  @media (min-width: 768px) {
    flex-wrap: nowrap;
    margin: 0;
  }
`;

interface TabProps {
  $active: boolean;
}

const Tab = styled(motion.button)<TabProps>`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ $active, theme }) => $active ? `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}dd)` : 'transparent'};
  border: none;
  color: ${({ $active, theme }) => $active ? 'white' : theme.colors.textSecondary};
  font-weight: ${({ $active, theme }) => $active ? theme.typography.fontWeight.bold : theme.typography.fontWeight.medium};
  cursor: pointer;
  position: relative;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: ${({ $active }) => $active ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none'};
  transition: all 0.3s ease;

  &:hover {
    background: ${({ $active, theme }) => !$active && `${theme.colors.surface}aa`};
    color: ${({ $active, theme }) => !$active && theme.colors.primary};
  }
`;

const TabContent = styled(motion.div)`
  padding: ${({ theme }) => theme.spacing.xl} 0;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.textSecondary};

  svg {
    font-size: 48px;
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }

  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.xl};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }

  p {
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    max-width: 400px;
    margin: 0 auto;
  }
`;


const Profile: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, updateProfile, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState('watchlist');
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [profileInfo, setProfileInfo] = useState({
    bio: '',
    location: '',
    website: '',
    social: {
      twitter: '',
      instagram: '',
      telegram: ''
    }
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
    if (user) {
      setEditedUsername(user.username);
      fetchProfileInfo();
    }
  }, [isLoading, isAuthenticated, router, user]);

  const fetchProfileInfo = async () => {
    try {
      const response = await fetch('/api/profile/info', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProfileInfo({
          bio: data.bio || '',
          location: data.location || '',
          website: data.website || '',
          social: data.social_links || {
            twitter: '',
            instagram: '',
            telegram: ''
          }
        });
      }
    } catch (error) {
      console.error('Error fetching profile info:', error);
    }
  };

  const tabs = [
    { id: 'watchlist', label: 'Смотреть позже', icon: FiList },
    { id: 'favorites', label: 'Избранное', icon: FiHeart },
    { id: 'history', label: 'История просмотров', icon: FiClock },
    { id: 'settings', label: 'Настройки', icon: FiSettings },
  ];

  if (!user) return null;

  return (
    <Layout>
      <ProfileContainer>
        <ProfileHeader>
          <Avatar
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  try {
                    const avatarData = await uploadAvatar(file);
                    if (user) {
                      const updatedUser = {
                        ...user,
                        avatar_id: avatarData.avatar_id,
                        avatar_url: avatarData.avatar_url
                      };
                      setUser(updatedUser);
                    }
                  } catch (error) {
                    console.error('Error uploading avatar:', error);
                  }
                }
              };
              input.click();
            }}
            style={{ cursor: 'pointer' }}
          >
            <AvatarImage 
              src={user?.avatar_url || "/default-avatar.svg"} 
              alt="Profile" 
            />
          </Avatar>
          <ProfileInfo>
            <Username>
              {isEditing ? (
                <input
                  value={editedUsername}
                  onChange={(e) => setEditedUsername(e.target.value)}
                  onBlur={async () => {
                    if (editedUsername !== user?.username) {
                      await updateProfile({ username: editedUsername });
                    }
                    setIsEditing(false);
                  }}
                  autoFocus
                />
              ) : (
                <>
                  {user?.username || 'Загрузка...'}
                  <EditButton
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsEditing(true)}
                  >
                    <FiEdit2 size={20} />
                  </EditButton>
                </>
              )}
            </Username>
            {profileInfo.bio && (
              <div style={{ marginTop: '1rem' }}>
                <h3>О себе</h3>
                <p>{profileInfo.bio}</p>
              </div>
            )}
            {profileInfo.location && (
              <div style={{ marginTop: '0.5rem' }}>
                <h3>Местоположение</h3>
                <p>{profileInfo.location}</p>
              </div>
            )}
            {profileInfo.website && (
              <div style={{ marginTop: '0.5rem' }}>
                <h3>Веб-сайт</h3>
                <a href={profileInfo.website} target="_blank" rel="noopener noreferrer">
                  {profileInfo.website}
                </a>
              </div>
            )}
            {Object.entries(profileInfo.social).some(([_, value]) => value) && (
              <div style={{ marginTop: '0.5rem' }}>
                <h3>Социальные сети</h3>
                {Object.entries(profileInfo.social).map(([network, value]) => (
                  value && (
                    <a 
                      key={network}
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginRight: '1rem' }}
                    >
                      {network}
                    </a>
                  )
                ))}
              </div>
            )}
            <Stats>
              <StatItem
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <span>{user?.views_count || 0}</span>
                <span>Просмотров</span>
              </StatItem>
              <StatItem
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <span>{user?.favorites_count || 0}</span>
                <span>В избранном</span>
              </StatItem>
              <StatItem
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <span>{user?.watchlist_count || 0}</span>
                <span>В списке</span>
              </StatItem>
            </Stats>
          </ProfileInfo>
        </ProfileHeader>

        <TabsContainer>
          <TabList>
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                $active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
              >
                {<tab.icon />}
                {tab.label}
              </Tab>
            ))}          
          </TabList>
          <AnimatePresence mode="wait">
            <TabContent
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {(() => {
                switch (activeTab) {
                  case 'settings':
                    return <ProfileSettings />;
                  case 'history':
                    return <WatchHistory />;
                  case 'favorites':
                    return <Favorites 
                      items={[]} 
                      onRemove={(id) => console.log('Remove:', id)} 
                      onWatch={(id) => console.log('Watch:', id)} 
                    />;
                  case 'watchlist':
                    return <EmptyState>
                      <FiUpload />
                      <h3>Список просмотра пуст</h3>
                      <p>Добавьте фильмы и сериалы, которые хотите посмотреть позже.</p>
                    </EmptyState>;
                  default:
                    return null;
                }
              })()}
            </TabContent>
          </AnimatePresence>
        </TabsContainer>
      </ProfileContainer>
    </Layout>
  );
};

export default Profile;
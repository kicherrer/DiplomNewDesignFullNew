import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiEdit2, FiSave, FiX } from 'react-icons/fi';

const ProfileInfoContainer = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const Section = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const EditButton = styled(motion.button)`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: ${({ theme }) => theme.spacing.md};
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Input = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md};
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.typography.fontSize.md};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.md};
`;

const Button = styled(motion.button)`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: white;

  &.save {
    background: ${({ theme }) => theme.colors.primary};
  }

  &.cancel {
    background: ${({ theme }) => theme.colors.error};
  }
`;

const SocialLinks = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;

interface ProfileData {
  bio: string;
  location: string;
  website: string;
  social: {
    twitter: string;
    instagram: string;
    telegram: string;
  };
}

interface ProfileInfoProps {
  data: ProfileData;
  onUpdate: (data: Partial<ProfileData>) => Promise<void>;
}

const ProfileInfo: React.FC<ProfileInfoProps> = ({ data, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(data);

  const handleSave = async () => {
    await onUpdate(editedData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData(data);
    setIsEditing(false);
  };

  return (
    <ProfileInfoContainer>
      <Section>
        <SectionTitle>
          О себе
          {!isEditing && (
            <EditButton
              onClick={() => setIsEditing(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FiEdit2 size={18} />
              Редактировать
            </EditButton>
          )}
        </SectionTitle>
        {isEditing ? (
          <>
            <TextArea
              value={editedData.bio}
              onChange={(e) => setEditedData({ ...editedData, bio: e.target.value })}
              placeholder="Расскажите о себе..."
            />
            <Input
              value={editedData.location}
              onChange={(e) => setEditedData({ ...editedData, location: e.target.value })}
              placeholder="Местоположение"
              style={{ marginTop: '1rem' }}
            />
            <Input
              value={editedData.website}
              onChange={(e) => setEditedData({ ...editedData, website: e.target.value })}
              placeholder="Веб-сайт"
              style={{ marginTop: '1rem' }}
            />
            <SectionTitle style={{ marginTop: '1.5rem' }}>Социальные сети</SectionTitle>
            <SocialLinks>
              <Input
                value={editedData.social.twitter}
                onChange={(e) => setEditedData({
                  ...editedData,
                  social: { ...editedData.social, twitter: e.target.value }
                })}
                placeholder="Twitter"
              />
              <Input
                value={editedData.social.instagram}
                onChange={(e) => setEditedData({
                  ...editedData,
                  social: { ...editedData.social, instagram: e.target.value }
                })}
                placeholder="Instagram"
              />
              <Input
                value={editedData.social.telegram}
                onChange={(e) => setEditedData({
                  ...editedData,
                  social: { ...editedData.social, telegram: e.target.value }
                })}
                placeholder="Telegram"
              />
            </SocialLinks>
            <ActionButtons>
              <Button
                className="save"
                onClick={handleSave}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FiSave size={18} />
                Сохранить
              </Button>
              <Button
                className="cancel"
                onClick={handleCancel}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FiX size={18} />
                Отмена
              </Button>
            </ActionButtons>
          </>
        ) : (
          <>
            <p>{data.bio || 'Нет описания'}</p>
            {data.location && <p>📍 {data.location}</p>}
            {data.website && (
              <p>
                🌐 <a href={data.website} target="_blank" rel="noopener noreferrer">{data.website}</a>
              </p>
            )}
            {(data.social.twitter || data.social.instagram || data.social.telegram) && (
              <>
                <SectionTitle>Социальные сети</SectionTitle>
                <SocialLinks>
                  {data.social.twitter && (
                    <a href={`https://twitter.com/${data.social.twitter}`} target="_blank" rel="noopener noreferrer">
                      Twitter: @{data.social.twitter}
                    </a>
                  )}
                  {data.social.instagram && (
                    <a href={`https://instagram.com/${data.social.instagram}`} target="_blank" rel="noopener noreferrer">
                      Instagram: @{data.social.instagram}
                    </a>
                  )}
                  {data.social.telegram && (
                    <a href={`https://t.me/${data.social.telegram}`} target="_blank" rel="noopener noreferrer">
                      Telegram: @{data.social.telegram}
                    </a>
                  )}
                </SocialLinks>
              </>
            )}
          </>
        )}
      </Section>
    </ProfileInfoContainer>
  );
};

export default ProfileInfo;
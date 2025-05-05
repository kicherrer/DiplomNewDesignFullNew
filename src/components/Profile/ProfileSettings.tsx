import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ProfileData } from '@/types/profile';

const SettingsContainer = styled.div`
  max-width: 600px;
  margin: 0 auto;
`;

const Section = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Label = styled.label`
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Input = styled.input`
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const TextArea = styled.textarea`
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  min-height: 100px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const SaveButton = styled(motion.button)`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  align-self: flex-start;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const Message = styled.div<{ type: string }>`
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: white;
  background: ${({ type, theme }) =>
    type === 'success' ? theme.colors.success : theme.colors.error};
  text-align: center;
`;

const ProfileSettings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [formData, setFormData] = useState<ProfileData>({
    bio: '',
    location: '',
    website: '',
    social: {
      twitter: '',
      instagram: '',
      telegram: ''
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchProfileInfo = async () => {
      try {
        const response = await fetch('/api/profile/info', {
          headers: {
            'Authorization': `Bearer ${localStorage?.getItem('token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setFormData({
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

    fetchProfileInfo();
  }, []);

  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/profile/info', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage?.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updatedData = await response.json();
        setFormData(prev => ({
          ...prev,
          ...updatedData
        }));
        setMessage({ type: 'success', text: 'Настройки успешно сохранены' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.message || 'Ошибка при сохранении настроек' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Произошла ошибка при сохранении настроек' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('social.')) {
      const socialNetwork = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        social: {
          ...prev.social,
          [socialNetwork]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <SettingsContainer>
      {message.text && <Message type={message.type}>{message.text}</Message>}
      <Form onSubmit={handleSubmit}>
        <Section>
          <SectionTitle>Основная информация</SectionTitle>
          <FormGroup>
            <Label>О себе</Label>
            <TextArea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Расскажите о себе"
            />
          </FormGroup>
          <FormGroup>
            <Label>Местоположение</Label>
            <Input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Ваш город"
            />
          </FormGroup>
          <FormGroup>
            <Label>Веб-сайт</Label>
            <Input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://example.com"
            />
          </FormGroup>
        </Section>

        <Section>
          <SectionTitle>Социальные сети</SectionTitle>
          <FormGroup>
            <Label>Twitter</Label>
            <Input
              type="text"
              name="social.twitter"
              value={formData.social.twitter}
              onChange={handleChange}
              placeholder="@username"
            />
          </FormGroup>
          <FormGroup>
            <Label>Instagram</Label>
            <Input
              type="text"
              name="social.instagram"
              value={formData.social.instagram}
              onChange={handleChange}
              placeholder="@username"
            />
          </FormGroup>
          <FormGroup>
            <Label>Telegram</Label>
            <Input
              type="text"
              name="social.telegram"
              value={formData.social.telegram}
              onChange={handleChange}
              placeholder="@username"
            />
          </FormGroup>
        </Section>

        <SaveButton
          type="submit"
          disabled={isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
        </SaveButton>
      </Form>
    </SettingsContainer>
  );
};

export default ProfileSettings;
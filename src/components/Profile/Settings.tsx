import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';

const SettingsContainer = styled.div`
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.md};
`;

const Section = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.text};
`;

const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface};

  &:last-child {
    border-bottom: none;
  }
`;

const SettingLabel = styled.label`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
`;

const Toggle = styled.label`
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
  cursor: pointer;
`;

const ToggleInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + span {
    background-color: ${({ theme }) => theme.colors.primary};
  }

  &:checked + span:before {
    transform: translateX(24px);
  }
`;

const ToggleSlider = styled.span`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${({ theme }) => theme.colors.surface};
  transition: 0.4s;
  border-radius: 34px;

  &:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
  }
`;

const Select = styled.select`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 2px solid ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const SaveButton = styled(motion.button)`
  margin-top: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  width: 100%;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const SuccessMessage = styled.div`
  color: ${({ theme }) => theme.colors.success};
  text-align: center;
  margin-top: ${({ theme }) => theme.spacing.md};
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  text-align: center;
  margin-top: ${({ theme }) => theme.spacing.md};
`;

const Settings: React.FC = () => {
  const { user, updateProfile, setUser } = useAuth();
  const [settings, setSettings] = useState(user?.settings || {
    notification_email: true,
    notification_web: true,
    privacy_profile: false,
    theme: 'light',
    language: 'ru'
  });
  
  useEffect(() => {
    if (user?.settings) {
      setSettings(user.settings);
    }
  }, [user]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await updateProfile({ settings });
      if (user) {
        const updatedUser = { ...user, settings };
        setUser(updatedUser);
      }
      setSuccess('Настройки успешно сохранены');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка при сохранении настроек');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsContainer>
      <Section>
        <SectionTitle>Уведомления</SectionTitle>
        <SettingRow>
          <SettingLabel>Email уведомления</SettingLabel>
          <Toggle>
            <ToggleInput
              type="checkbox"
              checked={settings.notification_email}
              onChange={(e) => setSettings({
                ...settings,
                notification_email: e.target.checked
              })}
            />
            <ToggleSlider />
          </Toggle>
        </SettingRow>
        <SettingRow>
          <SettingLabel>Веб-уведомления</SettingLabel>
          <Toggle>
            <ToggleInput
              type="checkbox"
              checked={settings.notification_web}
              onChange={(e) => setSettings({
                ...settings,
                notification_web: e.target.checked
              })}
            />
            <ToggleSlider />
          </Toggle>
        </SettingRow>
      </Section>

      <Section>
        <SectionTitle>Приватность</SectionTitle>
        <SettingRow>
          <SettingLabel>Закрытый профиль</SettingLabel>
          <Toggle>
            <ToggleInput
              type="checkbox"
              checked={settings.privacy_profile}
              onChange={(e) => setSettings({
                ...settings,
                privacy_profile: e.target.checked
              })}
            />
            <ToggleSlider />
          </Toggle>
        </SettingRow>
      </Section>

      <Section>
        <SectionTitle>Внешний вид</SectionTitle>
        <SettingRow>
          <SettingLabel>Тема</SettingLabel>
          <Select
            value={settings.theme}
            onChange={(e) => setSettings({
              ...settings,
              theme: e.target.value
            })}
          >
            <option value="light">Светлая</option>
            <option value="dark">Темная</option>
          </Select>
        </SettingRow>
        <SettingRow>
          <SettingLabel>Язык</SettingLabel>
          <Select
            value={settings.language}
            onChange={(e) => setSettings({
              ...settings,
              language: e.target.value
            })}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </Select>
        </SettingRow>
      </Section>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      <SaveButton
        onClick={handleSave}
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {loading ? 'Сохранение...' : 'Сохранить настройки'}
      </SaveButton>
    </SettingsContainer>
  );
};

export default Settings;
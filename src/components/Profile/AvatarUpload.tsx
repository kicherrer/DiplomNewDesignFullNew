import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiUpload, FiX } from 'react-icons/fi';
import { uploadAvatar } from '@/config/database';

const AvatarContainer = styled(motion.div)`
  position: relative;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const UploadOverlay = styled(motion.div)`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: opacity 0.2s;

  ${AvatarContainer}:hover & {
    opacity: 1;
  }
`;

const UploadInput = styled.input`
  display: none;
`;

const PreviewContainer = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const PreviewImage = styled.img`
  max-width: 90%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
`;

const PreviewActions = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xl};
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Button = styled(motion.button)`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: white;

  &.confirm {
    background: ${({ theme }) => theme.colors.primary};
  }

  &.cancel {
    background: ${({ theme }) => theme.colors.error};
  }
`;

const CloseButton = styled(motion.button)`
  position: absolute;
  top: ${({ theme }) => theme.spacing.xl};
  right: ${({ theme }) => theme.spacing.xl};
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.md};
`;

interface AvatarUploadProps {
  currentAvatar: string;
  onAvatarUpdate: (file: File) => Promise<void>;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({ currentAvatar, onAvatarUpdate }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleConfirm = async () => {
    if (selectedFile) {
      await onAvatarUpdate(selectedFile);
      handleCancel();
    }
  };

  const handleCancel = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <AvatarContainer
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => fileInputRef.current?.click()}
      >
        <AvatarImage src={currentAvatar || 'https://via.placeholder.com/150'} alt="Profile" />
        <UploadOverlay>
          <FiUpload size={24} />
          <span>Изменить фото</span>
        </UploadOverlay>
        <UploadInput
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
        />
      </AvatarContainer>

      {previewUrl && (
        <PreviewContainer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <CloseButton
            onClick={handleCancel}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <FiX size={24} />
          </CloseButton>
          <PreviewImage src={previewUrl} alt="Preview" />
          <PreviewActions>
            <Button
              className="confirm"
              onClick={handleConfirm}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiUpload size={20} />
              Сохранить
            </Button>
            <Button
              className="cancel"
              onClick={handleCancel}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiX size={20} />
              Отмена
            </Button>
          </PreviewActions>
        </PreviewContainer>
      )}
    </>
  );
};

export default AvatarUpload;
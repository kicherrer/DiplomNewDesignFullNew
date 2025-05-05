import { User } from '@/types/user';

export const uploadAvatar = async (file: File): Promise<{ avatar_id: string; avatar_url: string }> => {
  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const response = await fetch('/api/profile/avatar', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка при загрузке аватара');
    }

    const data = await response.json();
    return {
      avatar_id: data.avatar_id,
      avatar_url: data.avatar_url
    };
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
};
import { api } from './client';
import { SessionUserRole } from '@/components/providers/auth-provider';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  wechatAvatar: string | null;
  phoneNumber: string | null;
  bio: string | null;
  role: SessionUserRole;
}

export interface UpdateProfileData {
  name?: string;
  phoneNumber?: string;
  image?: string;
  bio?: string;
}

export interface UploadResponse {
  url: string;
  name: string;
}

export const userApi = {
  getProfile: () => 
    api.get<UserProfile>('/api/user/profile'),

  updateProfile: (data: UpdateProfileData) =>
    api.put<UserProfile>('/api/user/profile', data),

  uploadAvatar: async (file: File): Promise<string> => {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    // 验证文件大小（限制为 5MB）
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      throw new Error('File size must be less than 5MB');
    }

    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload avatar');
      }
      
      const data = await response.json() as UploadResponse;
      return data.url;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to upload avatar');
    }
  }
};

export default userApi; 
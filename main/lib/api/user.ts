import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  isSystemAdmin: boolean;
  ethAddress: string | null;
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

export interface ApiKey {
  id: number;
  key: string;
  created_at: string;
  status: 'PENDING' | 'APPROVED' | 'BANNED';
}

export interface ApiKeysResponse {
  data: ApiKey[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface GetApiKeysParams {
  page?: number;
  limit?: number;
}

// API functions
const fetchProfile = async (): Promise<UserProfile> => {
  return api.get<UserProfile>('/api/user/profile');
};

const updateProfile = async (data: UpdateProfileData): Promise<UserProfile> => {
  return api.put<UserProfile>('/api/user/profile', data);
};

const fetchApiKeys = async (params: GetApiKeysParams = {}): Promise<ApiKeysResponse> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  return api.get<ApiKeysResponse>(`/api/user/api-keys?${searchParams.toString()}`);
};

const uploadAvatar = async (file: File): Promise<string> => {
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
};

// React Query hooks
export const useUserProfile = () => {
  return useQuery({
    queryKey: ["user", "profile"],
    queryFn: fetchProfile,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      // Update the profile in cache
      queryClient.setQueryData(["user", "profile"], data);
    },
    onError: (error) => {
      console.error('Update profile error:', error);
    },
  });
};

export const useApiKeys = (params: GetApiKeysParams = {}) => {
  return useQuery({
    queryKey: ["user", "apiKeys", params],
    queryFn: () => fetchApiKeys(params),
  });
};

// Legacy API object for backward compatibility
export const userApi = {
  getProfile: fetchProfile,
  updateProfile: updateProfile,
  getApiKeys: fetchApiKeys,
  uploadAvatar: uploadAvatar,
};

export default userApi; 
import { api } from './client';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  wechatAvatar: string | null;
  phoneNumber: string | null;
  role: string;
}

export interface UpdateProfileData {
  name?: string;
  phoneNumber?: string;
}

export const userApi = {
  getProfile: () => 
    api.get<UserProfile>('/api/user/profile'),

  updateProfile: (data: UpdateProfileData) =>
    api.put<UserProfile>('/api/user/profile', data),
};

export default userApi; 
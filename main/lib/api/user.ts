import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { SessionUserRole } from "@/components/providers/auth-provider";

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
  status: "PENDING" | "APPROVED" | "BANNED";
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
  return api.get<UserProfile>("/api/user/profile");
};

const updateProfile = async (data: UpdateProfileData): Promise<UserProfile> => {
  return api.put<UserProfile>("/api/user/profile", data);
};

const fetchApiKeys = async (
  params: GetApiKeysParams = {}
): Promise<ApiKeysResponse> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());
  return api.get<ApiKeysResponse>(
    `/api/user/api-keys?${searchParams.toString()}`
  );
};

const uploadAvatar = async (file: File): Promise<string> => {
  // 验证文件类型
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  // 验证文件大小（限制为 5MB）
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    throw new Error("File size must be less than 5MB");
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to upload avatar");
    }

    const data = (await response.json()) as UploadResponse;
    return data.url;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to upload avatar");
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
      console.error("Update profile error:", error);
    },
  });
};

export const useApiKeys = (params: GetApiKeysParams = {}) => {
  return useQuery({
    queryKey: ["user", "apiKeys", params],
    queryFn: () => fetchApiKeys(params),
  });
};

// Phone binding types
export interface SendBindCodeResponse {
  success: boolean;
  message: string;
  phoneNumber?: string;
  error?: string;
}

export interface BindPhoneResponse {
  success: boolean;
  message: string;
  phoneNumber?: string;
  error?: string;
}

// Phone binding API functions
const sendBindCode = async (
  phoneNumber: string
): Promise<SendBindCodeResponse> => {
  return api.post<SendBindCodeResponse>("/api/user/phone/send-bind-code", {
    phoneNumber,
  });
};

const bindPhone = async (
  phoneNumber: string,
  code: string
): Promise<BindPhoneResponse> => {
  return api.post<BindPhoneResponse>("/api/user/phone/bind", {
    phoneNumber,
    code,
  });
};

// Phone binding hooks
export const useSendBindCode = () => {
  return useMutation({
    mutationFn: sendBindCode,
    onError: (error) => {
      console.error("Send bind code error:", error);
    },
  });
};

export const useBindPhone = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      phoneNumber,
      code,
    }: {
      phoneNumber: string;
      code: string;
    }) => bindPhone(phoneNumber, code),
    onSuccess: () => {
      // Invalidate and refetch user profile
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    },
    onError: (error) => {
      console.error("Bind phone error:", error);
    },
  });
};

// Account deletion types
export interface DeletionStatusResponse {
  isPendingDelete: boolean;
  deletionRequestedAt?: string;
  deletionDate?: string;
  coolingPeriodDays?: number;
}

export interface RequestDeletionResponse {
  success: boolean;
  message: string;
  deletionDate?: string;
  coolingPeriodDays?: number;
  notice?: string;
  error?: string;
}

export interface CancelDeletionResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Account deletion API functions
const getDeletionStatus = async (): Promise<DeletionStatusResponse> => {
  return api.get<DeletionStatusResponse>("/api/user/account/request-deletion");
};

const requestDeletion = async (
  confirmPhrase: string
): Promise<RequestDeletionResponse> => {
  return api.post<RequestDeletionResponse>(
    "/api/user/account/request-deletion",
    { confirmPhrase }
  );
};

const cancelDeletion = async (): Promise<CancelDeletionResponse> => {
  return api.post<CancelDeletionResponse>(
    "/api/user/account/cancel-deletion",
    {}
  );
};

// Account deletion hooks
export const useDeletionStatus = () => {
  return useQuery({
    queryKey: ["user", "deletionStatus"],
    queryFn: getDeletionStatus,
  });
};

export const useRequestDeletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: requestDeletion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "deletionStatus"] });
    },
    onError: (error) => {
      console.error("Request deletion error:", error);
    },
  });
};

export const useCancelDeletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelDeletion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "deletionStatus"] });
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    },
    onError: (error) => {
      console.error("Cancel deletion error:", error);
    },
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

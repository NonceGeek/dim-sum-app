import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from './client';

export interface NonceResponse {
  nonce: string;
  message: string;
  expires: number;
}

export interface BindWalletRequest {
  address: string;
  signature: string;
  nonce: string;
}

export interface BindWalletResponse {
  address: string;
  message: string;
}

export interface UnbindWalletResponse {
  message: string;
}

// API functions
const fetchNonce = async (): Promise<NonceResponse> => {
  return api.get<NonceResponse>('/api/wallet/nonce');
};

const bindWallet = async (data: BindWalletRequest): Promise<BindWalletResponse> => {
  return api.post<BindWalletResponse>('/api/wallet/bind', data);
};

const unbindWallet = async (): Promise<UnbindWalletResponse> => {
  return api.post<UnbindWalletResponse>('/api/wallet/unbind');
};

// React Query hooks
export const useGetNonce = () => {
  return useQuery({
    queryKey: ["wallet", "nonce"],
    queryFn: fetchNonce,
    enabled: false, // Only fetch when manually triggered
    staleTime: 0, // Always fetch fresh nonce
  });
};

export const useBindWallet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bindWallet,
    onSuccess: () => {
      // Invalidate user profile to refresh wallet info
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    },
    onError: (error) => {
      console.error('Bind wallet error:', error);
    },
  });
};

export const useUnbindWallet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unbindWallet,
    onSuccess: () => {
      // Invalidate user profile to refresh wallet info
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    },
    onError: (error) => {
      console.error('Unbind wallet error:', error);
    },
  });
};

// Legacy API object for backward compatibility
export const walletApi = {
  getNonce: fetchNonce,
  bindWallet: bindWallet,
  unbindWallet: unbindWallet,
};

export default walletApi;
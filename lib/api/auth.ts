import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

interface QrCodeResponse {
  ticket: string;
  expire_seconds: number;
  url: string;
  qrcode_url: string;
}

interface QrCodeStatusResponse {
  status: "waiting" | "scanned";
}

// API functions
const fetchQrCode = async (): Promise<QrCodeResponse> => {
  return api.get<QrCodeResponse>("/api/auth/wechat/qrcode");
};

const checkQrCodeStatus = async (ticket: string): Promise<QrCodeStatusResponse> => {
  return api.get<QrCodeStatusResponse>(`/api/auth/wechat/qrcode/check?ticket=${ticket}`);
};

// React Query hooks
export const useQrCode = () => {
  return useQuery({
    queryKey: ["qrCode"],
    queryFn: fetchQrCode,
    enabled: false, // Don't fetch automatically
  });
};

export const useQrCodeStatus = (ticket: string | null) => {
  return useQuery({
    queryKey: ["qrCodeStatus", ticket],
    queryFn: () => checkQrCodeStatus(ticket!),
    enabled: !!ticket, // Only fetch when ticket is available
    refetchInterval: (query) => {
      // Stop polling when QR code is scanned
      return query.state.data?.status === "scanned" ? false : 2000;
    },
  });
}; 
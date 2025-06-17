import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

interface MarkerProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  phoneNumber: string | null;
  isMarker: boolean;
  lastAccessed: string;
}

export function useMarkerProfile() {
  return useQuery<MarkerProfile>({
    queryKey: ["markerProfile"],
    queryFn: () => api.get<MarkerProfile>("/api/marker/profile"),
  });
} 
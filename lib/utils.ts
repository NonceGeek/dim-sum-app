import { SessionUserRole } from '@/components/providers/auth-provider';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isWechatBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  return ua.indexOf("micromessenger") !== -1;
}

export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// 角色显示转换函数
export const formatRole = (role: SessionUserRole) => {
  const roleMap: Record<SessionUserRole, string> = {
    'LEARNER': 'Learner',
    'TAGGER_PARTNER': 'Tagger',
    'TAGGER_OUTSOURCING': 'Tagger',
    'RESEARCHER': 'Researcher'
  };
  return roleMap[role] || role;
};
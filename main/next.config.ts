import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'thirdwx.qlogo.cn',
      },
      {
        protocol: 'https',
        hostname: 'dimsum-user-avatar.oss-cn-guangzhou.aliyuncs.com',
      },
    ],
  },
};

export default nextConfig;

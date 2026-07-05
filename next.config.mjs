/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Gallery photos are already small, pre-sized files; skip runtime optimization
    // to avoid unnecessary CPU (dev) and image-optimization usage (Vercel).
    unoptimized: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default withPWA({
  ...nextConfig,
  pwa: {
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
    runtimeCaching: [
      {
        urlPattern: /^https?:\\/\\/.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "images",
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
      },
      {
        urlPattern: /^https?:\\/\\/.*\\.(?:css|js)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-resources",
        },
      },
      {
        urlPattern: /^https?:\\/\\/[^/]*$/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "pages",
          networkTimeoutSeconds: 3,
        },
      },
      {
        urlPattern: /^\\/api\\//,
        handler: "NetworkOnly",
      },
    ],
  },
});

import type { NextConfig } from "next";

// The Content-Security-Policy is deliberately *not* here. It carries a
// per-request nonce so production can drop `script-src 'unsafe-inline'`, and a
// statically configured header cannot vary per request — see
// src/lib/proxy/content-security-policy.ts. Everything below is constant, which
// is exactly what this file is good at.
const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(), microphone=()",
          },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:3001";
    return [
      // The browser stays on the frontend origin. Next forwards every API and
      // auth callback over HTTP to the independently deployable Backend, so
      // cookies remain first-party without putting credentials or database
      // code in this project.
      { source: "/api/insights", destination: `${backendUrl}/api/v1/insights` },
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/auth/callback", destination: `${backendUrl}/auth/callback` },
      { source: "/auth/callback/:path*", destination: `${backendUrl}/auth/callback/:path*` },
    ];
  },
};

export default nextConfig;

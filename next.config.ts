import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // app.thetaxio.com is the app itself: skip the marketing home page and
      // open the login screen. Other domains keep the home page as before.
      {
        source: "/",
        has: [{ type: "host", value: "app.thetaxio.com" }],
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

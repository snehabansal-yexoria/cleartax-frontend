import type { NextConfig } from "next";

// App domains: skip the marketing home page and open the login screen.
// Other domains keep the home page as before.
const APP_HOSTS = ["app.yexoria.com", "app.thetaxio.com"];

const nextConfig: NextConfig = {
  async redirects() {
    return APP_HOSTS.map((host) => ({
      source: "/",
      has: [{ type: "host" as const, value: host }],
      destination: "/login",
      permanent: false,
    }));
  },
};

export default nextConfig;

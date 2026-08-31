import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` runs as a Windows process here even under WSL, so it's only
  // reachable from WSL via its LAN IP, not `localhost` (see CLAUDE.md
  // Session 1 log). Next's dev-only cross-origin protection blocks that
  // origin by default and silently breaks client hydration — this
  // allowlist is dev-only testing convenience, irrelevant in production.
  allowedDevOrigins: ["192.168.0.75"],
};

export default nextConfig;

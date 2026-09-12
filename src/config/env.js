const required = [
  "MONGO_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "ENV_ENCRYPTION_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (Buffer.from(process.env.ENV_ENCRYPTION_KEY, "hex").length !== 32) {
  throw new Error("ENV_ENCRYPTION_KEY must be a 32-byte hex string");
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI,
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(","),
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  accessTokenExpires: process.env.ACCESS_TOKEN_EXPIRES || "15m",
  refreshTokenExpires: process.env.REFRESH_TOKEN_EXPIRES || "7d",
  envEncryptionKey: process.env.ENV_ENCRYPTION_KEY,
  baseWorkspaceDomain: process.env.BASE_WORKSPACE_DOMAIN || "localhost",
  // Set only for local dev, where Traefik can't bind the standard :80 (something
  // else already owns it). Left unset in production — the proxy binds 80/443 there.
  workspaceProxyPort: process.env.WORKSPACE_PROXY_PORT || "",
  // "http" locally (no cert), "https" in production (nginx terminates TLS in front of Traefik).
  workspaceProtocol: process.env.WORKSPACE_PROTOCOL || "http",
  // Comma-separated. Any account with a matching email is auto-promoted to
  // admin on login/register — no manual DB editing needed to bootstrap the
  // first admin, and adding a second is a one-line env change.
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
};

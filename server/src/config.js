import dotenv from "dotenv";

// Load .env when present (local dev). In Docker/Coolify the vars come from the
// environment directly, so a missing .env file is fine.
dotenv.config();

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: process.env.JWT_SECRET || "insecure-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  // Base URL used to build links in emails (e.g. password reset). Falls back
  // to localhost for dev; set to the real deployed origin in production.
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || "8080"}`,
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Dansk <no-reply@dansk.app>",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  },
};

export const isProd = config.nodeEnv === "production";

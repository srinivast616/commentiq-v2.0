import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  aiProvider: (process.env.AI_PROVIDER ?? "mock") as "anthropic" | "mock",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "",
};

import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

   OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  //Google Sheets credentials 
  SPREADSHEET_ID: z.string().min(1, "SPREADSHEET_ID is required"),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email("Invalid Google service account email"),
  GOOGLE_PRIVATE_KEY: z.string().min(1, "GOOGLE_PRIVATE_KEY is required"),

  CORS_ORIGIN: z.string().default("http://localhost:8080"),
  SESSION_TTL_DAYS: z.coerce.number().default(7),
  FEATURED_DEFAULT_WEIGHT: z.coerce.number().min(0).max(1).default(0.6),
  // Admin API key — required in production for /api/admin/* endpoints
  ADMIN_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[config] ❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (!parsed.data.OPENAI_API_KEY && !parsed.data.GEMINI_API_KEY) {
  console.error("[config] ❌ Provide at least one AI key: OPENAI_API_KEY or GEMINI_API_KEY");
  process.exit(1);
}

export const env = parsed.data;

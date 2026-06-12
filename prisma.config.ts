import { defineConfig } from "@prisma/config";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

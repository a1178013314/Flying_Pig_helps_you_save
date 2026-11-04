import { registerAs } from "@nestjs/config";

export const dbConfig = registerAs("db", () => ({
  path: process.env.DB_PATH ?? "data/flypig.sqlite",
}));

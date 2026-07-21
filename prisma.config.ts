import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const placeholderDatabaseUrl = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  migrations: {
    path: 'src/prisma/migrations',
  },
  datasource: {
    // Client generation and validation do not contact the database, so CI can
    // safely use a syntactically valid placeholder when no secret is present.
    url: process.env.DATABASE_URL ?? placeholderDatabaseUrl,
  },
});

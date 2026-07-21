import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import config from '../config/config.js';

const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

const prisma = new PrismaClient({ adapter });

export default prisma;

import { csvEnv, env, requireEnv, snowflakeEnv } from '../utils/env.js';

const generalCategoryId = snowflakeEnv('GENERAL_TICKETS_CATEGORY_ID', '1340718323368726629');
const archivedCategoryId = snowflakeEnv('ARCHIVED_TICKETS_CATEGORY_ID', '1355965600408539176');

const defaultConfigurableRoleIds = [
  '1228653981010497597',
  '1325778907286212608',
  '1338957456918708235',
  '1228653981010497599',
  '1228653981010497598',
  '1228653981010497601',
  '1228653981048377366',
  '1228653981048377371',
  '1345028092996882432',
  '1228653981048377373',
  '1228653981086257183',
  '1228653981086257188',
  '1228653981086257184',
  '1228653981115355196',
] as const;

export default {
  token: requireEnv('DISCORD_TOKEN'),
  databaseUrl: requireEnv('DATABASE_URL'),
  pythonExecutable: env('PYTHON_EXECUTABLE', process.platform === 'win32' ? 'python' : 'python3'),
  ticketsChannelId: snowflakeEnv('TICKETS_CHANNEL_ID', '1238583192047325234'),
  ticketsChannelId2: snowflakeEnv('TICKETS_ANNOUNCEMENT_CHANNEL_ID', '1355964984550756352'),
  generalTicketsCategoryId: generalCategoryId,
  archivedGeneralTicketsCategoryId: snowflakeEnv('ARCHIVED_GENERAL_TICKETS_CATEGORY_ID', archivedCategoryId),
  appealTicketsCategoryId: snowflakeEnv('APPEAL_TICKETS_CATEGORY_ID', '1340718342251610182'),
  archivedAppealTicketsCategoryId: snowflakeEnv('ARCHIVED_APPEAL_TICKETS_CATEGORY_ID', archivedCategoryId),
  partnershipTicketsCategoryId: snowflakeEnv('PARTNERSHIP_TICKETS_CATEGORY_ID', '1355965812527206590'),
  archivedPartnershipTicketsCategoryId: snowflakeEnv('ARCHIVED_PARTNERSHIP_TICKETS_CATEGORY_ID', archivedCategoryId),
  storeTicketsCategoryId: snowflakeEnv('STORE_TICKETS_CATEGORY_ID', '1340718360211488778'),
  archivedStoreTicketsCategoryId: snowflakeEnv('ARCHIVED_STORE_TICKETS_CATEGORY_ID', archivedCategoryId),
  ticketsCategoryId: snowflakeEnv('TICKETS_CATEGORY_ID', '1340718342251610182'),
  archivedTicketsCategoryId: archivedCategoryId,
  BlacklistRoleId: snowflakeEnv('BLACKLIST_ROLE_ID', '1264857224338079755'),
  staffRoleId: snowflakeEnv('STAFF_ROLE_ID', '1228653981010497601'),
  adminRoleId: snowflakeEnv('ADMIN_ROLE_ID', '1228653981048377373'),
  screenshareRoleId: snowflakeEnv('SCREENSHARE_ROLE_ID', '1345036712367226961'),
  ticketLogsChannelId1: snowflakeEnv('TICKET_LOGS_CHANNEL_ID_1', '1345036777492058215'),
  ticketLogsChannelId2: snowflakeEnv('TICKET_LOGS_CHANNEL_ID_2', '1345036791094448212'),
  storeChannelID: snowflakeEnv('STORE_CHANNEL_ID', '1292050904622563412'),
  SSAppealTeamRoleId: snowflakeEnv('SS_APPEAL_TEAM_ROLE_ID', '1338957456918708235'),
  clientId: snowflakeEnv('CLIENT_ID', '1355964332957110456'),
  guildId: snowflakeEnv('GUILD_ID', '1228653980780072981'),
  transcriptChannel1: snowflakeEnv('TRANSCRIPT_CHANNEL_ID_1', '1228653985876021294'),
  transcriptChannel2: snowflakeEnv('TRANSCRIPT_CHANNEL_ID_2', '1299390184785182770'),
  boosterRoleId: snowflakeEnv('BOOSTER_ROLE_ID', '1243398569206222892'),
  managerRoleId: snowflakeEnv('MANAGER_ROLE_ID', '1228653981086257188'),
  ownerRoleId: snowflakeEnv('OWNER_ROLE_ID', '1228653981086257188'),
  staffReportTicketsCategoryId: snowflakeEnv('STAFF_REPORT_TICKETS_CATEGORY_ID', generalCategoryId),
  archivedStaffReportTicketsCategoryId: snowflakeEnv('ARCHIVED_STAFF_REPORT_TICKETS_CATEGORY_ID', archivedCategoryId),
  configurableRoleIds: csvEnv('CONFIGURABLE_ROLE_IDS', defaultConfigurableRoleIds),
} as const;


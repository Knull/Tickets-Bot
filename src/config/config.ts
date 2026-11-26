
// src/config/config.ts
// The bot token is read from the environment (see .env.example); never commit it.
import 'dotenv/config';

export default {
    token: process.env.DISCORD_TOKEN ?? '',
    ticketsChannelId: '1238583192047325234',
    ticketsChannelId2: '1355964984550756352',
    generalTicketsCategoryId: '1340718323368726629',
    archivedGeneralTicketsCategoryId: '1355965600408539176',
    appealTicketsCategoryId: '1340718342251610182',
    archivedAppealTicketsCategoryId: '1355965600408539176',
    partnershipTicketsCategoryId: '1355965812527206590',
    archivedPartnershipTicketsCategoryId: '1355965600408539176',
    storeTicketsCategoryId: '1340718360211488778',
    archivedStoreTicketsCategoryId: '1355965600408539176',
    ticketsCategoryId: '1340718342251610182', // fallback
    archivedTicketsCategoryId: '1355965600408539176',
    BlacklistRoleId: '1264857224338079755',
    staffRoleId: '1228653981010497601',
    adminRoleId: '1228653981048377373',
    // change from here
    screenshareRoleId: '1345036712367226961',
    ticketLogsChannelId1: '1345036777492058215',
    ticketLogsChannelId2: '1345036791094448212',
    storeChannelID: '1292050904622563412',
    SSAppealTeamRoleId: '1338957456918708235',
    clientId: '1355964332957110456',
    guildId: '1228653980780072981',
    transcriptChannel1: '1228653985876021294',
    transcriptChannel2: '1299390184785182770',
    boosterRoleId: '1243398569206222892',
    managerRoleId: '1228653981086257188',
    ownerRoleId: '1228653981086257188',
    staffReportTicketsCategoryId: '11',
    archivedStaffReportTicketsCategoryId: '111'
  };
  
import config from '../config/config.js';

function categoryGroup(ticketType: string): 'General' | 'Appeal' | 'Staff Report' | 'Partnership' | 'Store' {
  if (ticketType === 'General') return 'General';
  if (ticketType === 'Store') return 'Store';
  if (ticketType === 'Partnership') return 'Partnership';
  if (ticketType === 'Staff Report') return 'Staff Report';
  if (ticketType.includes('Appeal')) return 'Appeal';
  return 'General';
}

export function getCategoryId(ticketType: string, isArchived = false): string {
  const categoryMapping = {
    General: isArchived ? config.archivedGeneralTicketsCategoryId : config.generalTicketsCategoryId,
    Appeal: isArchived ? config.archivedAppealTicketsCategoryId : config.appealTicketsCategoryId,
    'Staff Report': isArchived
      ? config.archivedStaffReportTicketsCategoryId
      : config.staffReportTicketsCategoryId,
    Partnership: isArchived
      ? config.archivedPartnershipTicketsCategoryId
      : config.partnershipTicketsCategoryId,
    Store: isArchived ? config.archivedStoreTicketsCategoryId : config.storeTicketsCategoryId,
  } as const;

  return categoryMapping[categoryGroup(ticketType)];
}

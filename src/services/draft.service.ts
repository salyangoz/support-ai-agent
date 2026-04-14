import * as draftRepo from '../repositories/draft.repository';

export async function getDraftsByTicketId(tenantId: string, ticketId: string) {
  return draftRepo.findDraftsByTicketId(tenantId, ticketId);
}

export async function getDraftById(tenantId: string, id: string) {
  return draftRepo.findDraftById(tenantId, id);
}

export async function updateDraftStatus(
  tenantId: string,
  id: string,
  status: string,
  reviewedBy?: string,
) {
  return draftRepo.updateDraftStatus(tenantId, id, status, reviewedBy);
}

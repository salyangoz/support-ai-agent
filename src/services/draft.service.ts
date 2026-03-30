import * as draftRepo from '../repositories/draft.repository';

export async function getDraftsByTicketId(tenantId: number, ticketId: number) {
  return draftRepo.findDraftsByTicketId(tenantId, ticketId);
}

export async function getDraftById(tenantId: number, id: number) {
  return draftRepo.findDraftById(tenantId, id);
}

export async function updateDraftStatus(
  tenantId: number,
  id: number,
  status: string,
  reviewedBy?: string,
) {
  return draftRepo.updateDraftStatus(tenantId, id, status, reviewedBy);
}

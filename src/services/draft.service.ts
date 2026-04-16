import * as draftRepo from '../repositories/draft.repository';

export async function getDraftsByTenantId(
  tenantId: string,
  filters?: { status?: string; cursor?: string; limit?: number; offset?: number },
) {
  return draftRepo.findDraftsByTenantId(tenantId, filters);
}

export async function getDraftsByTicketId(
  tenantId: string,
  ticketId: string,
  opts?: { cursor?: string; limit?: number },
) {
  return draftRepo.findDraftsByTicketId(tenantId, ticketId, opts);
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

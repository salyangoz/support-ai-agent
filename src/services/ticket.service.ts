import * as ticketRepo from '../repositories/ticket.repository';
import * as messageRepo from '../repositories/message.repository';

export async function getTickets(
  tenantId: number,
  opts?: {
    inputAppId?: number;
    state?: string;
    customerId?: number;
    page?: number;
    limit?: number;
  },
) {
  return ticketRepo.findTicketsByTenantId(tenantId, opts);
}

export async function getTicketWithMessages(tenantId: number, id: number) {
  const ticket = await ticketRepo.findTicketById(tenantId, id);
  if (!ticket) {
    return null;
  }

  const messages = await messageRepo.findMessagesByTicketId(id, tenantId);
  return { ticket, messages };
}

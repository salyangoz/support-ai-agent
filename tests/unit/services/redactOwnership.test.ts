/**
 * Ownership guard for Intercom redact:
 * verifies that sendDraft only passes conversation_part_ids that our own
 * system previously stored to adapter.redactPart — never ids written by
 * any other flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/repositories/draft.repository', () => ({
  findDraftById: vi.fn(),
  findPreviousSentNotes: vi.fn(),
  markDraftSent: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock('../../../src/repositories/ticket.repository', () => ({
  findTicketById: vi.fn(),
}));
vi.mock('../../../src/apps/app.resolver', () => ({
  resolveOutputApps: vi.fn(),
}));
vi.mock('../../../src/apps/app.factory', () => ({
  createOutputApp: vi.fn(),
}));

import * as draftRepo from '../../../src/repositories/draft.repository';
import * as ticketRepo from '../../../src/repositories/ticket.repository';
import { resolveOutputApps } from '../../../src/apps/app.resolver';
import { createOutputApp } from '../../../src/apps/app.factory';
import { sendDraft } from '../../../src/services/aiDraft.service';

const TENANT = { id: 't1', settings: {} } as any;
const TICKET = { id: 'tk1', tenantId: 't1', externalId: 'conv-123' } as any;
const APP = { id: 'app-1', code: 'intercom', tenantId: 't1' } as any;

function mockAdapter() {
  return {
    isNoteMode: () => true,
    redactPart: vi.fn().mockResolvedValue(undefined),
    sendReply: vi.fn().mockResolvedValue({ externalMessageId: 'new-part-id' }),
  };
}

describe('redact ownership guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(draftRepo.findDraftById).mockResolvedValue({
      id: 'draft-2',
      tenantId: 't1',
      ticketId: 'tk1',
      draftResponse: 'new draft body',
    } as any);
    vi.mocked(ticketRepo.findTicketById).mockResolvedValue(TICKET);
    vi.mocked(resolveOutputApps).mockResolvedValue([APP]);
    vi.mocked(draftRepo.markDraftSent).mockResolvedValue({} as any);
  });

  it('redacts ids that our own send stored AS A NOTE (happy path)', async () => {
    const adapter = mockAdapter();
    vi.mocked(createOutputApp).mockReturnValue(adapter as any);

    vi.mocked(draftRepo.findPreviousSentNotes).mockResolvedValue([
      {
        id: 'draft-1',
        tenantId: 't1',
        ticketId: 'tk1',
        externalAppId: 'app-1',
        externalMessageId: 'our-stored-id',
        status: 'sent',
        sentAsNote: true,
      },
    ] as any);

    await sendDraft(TENANT, 'draft-2');

    expect(adapter.redactPart).toHaveBeenCalledTimes(1);
    expect(adapter.redactPart).toHaveBeenCalledWith('conv-123', 'our-stored-id');
  });

  it('does NOT redact a draft that was sent as a comment (sentAsNote=false)', async () => {
    const adapter = mockAdapter();
    vi.mocked(createOutputApp).mockReturnValue(adapter as any);

    // Simulate a pathological DB state where a comment id slipped into the
    // result of findPreviousSentNotes. The service-level guard must still
    // refuse to redact it.
    vi.mocked(draftRepo.findPreviousSentNotes).mockResolvedValue([
      {
        id: 'draft-1',
        tenantId: 't1',
        ticketId: 'tk1',
        externalAppId: 'app-1',
        externalMessageId: 'customer-visible-comment-id',
        status: 'sent',
        sentAsNote: false,
      },
    ] as any);

    await sendDraft(TENANT, 'draft-2');

    expect(adapter.redactPart).not.toHaveBeenCalled();
  });

  it('does not redact a draft whose status is not "sent"', async () => {
    const adapter = mockAdapter();
    vi.mocked(createOutputApp).mockReturnValue(adapter as any);

    vi.mocked(draftRepo.findPreviousSentNotes).mockResolvedValue([
      {
        id: 'draft-1',
        tenantId: 't1',
        ticketId: 'tk1',
        externalAppId: 'app-1',
        externalMessageId: 'mystery-id',
        status: 'pending',
        sentAsNote: true,
      },
    ] as any);

    await sendDraft(TENANT, 'draft-2');

    expect(adapter.redactPart).not.toHaveBeenCalled();
  });

  it('does not redact a draft whose tenantId does not match', async () => {
    const adapter = mockAdapter();
    vi.mocked(createOutputApp).mockReturnValue(adapter as any);

    vi.mocked(draftRepo.findPreviousSentNotes).mockResolvedValue([
      {
        id: 'draft-1',
        tenantId: 'different-tenant',
        ticketId: 'tk1',
        externalAppId: 'app-1',
        externalMessageId: 'foreign-tenant-id',
        status: 'sent',
        sentAsNote: true,
      },
    ] as any);

    await sendDraft(TENANT, 'draft-2');

    expect(adapter.redactPart).not.toHaveBeenCalled();
  });

  it('does not redact a draft whose externalAppId does not match', async () => {
    const adapter = mockAdapter();
    vi.mocked(createOutputApp).mockReturnValue(adapter as any);

    vi.mocked(draftRepo.findPreviousSentNotes).mockResolvedValue([
      {
        id: 'draft-1',
        tenantId: 't1',
        ticketId: 'tk1',
        externalAppId: 'different-app',
        externalMessageId: 'other-app-id',
        status: 'sent',
        sentAsNote: true,
      },
    ] as any);

    await sendDraft(TENANT, 'draft-2');

    expect(adapter.redactPart).not.toHaveBeenCalled();
  });

  it('does not redact when externalMessageId is null (never set by our send)', async () => {
    const adapter = mockAdapter();
    vi.mocked(createOutputApp).mockReturnValue(adapter as any);

    vi.mocked(draftRepo.findPreviousSentNotes).mockResolvedValue([
      {
        id: 'draft-1',
        tenantId: 't1',
        ticketId: 'tk1',
        externalAppId: 'app-1',
        externalMessageId: null,
        status: 'sent',
        sentAsNote: true,
      },
    ] as any);

    await sendDraft(TENANT, 'draft-2');

    expect(adapter.redactPart).not.toHaveBeenCalled();
  });
});

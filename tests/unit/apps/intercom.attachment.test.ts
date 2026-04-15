import { describe, it, expect } from 'vitest';
import {
  mapConversationPartsToMessages,
  mapInitialMessageToNormalized,
} from '../../../src/apps/intercom/intercom.mapper';

describe('Intercom Attachment Mapping', () => {
  it('should map attachments from conversation parts', () => {
    const parts = [
      {
        id: '100',
        part_type: 'comment',
        body: '<p>Here is the screenshot</p>',
        author: { type: 'user', id: '1', name: 'Alice' },
        attachments: [
          {
            id: 'att-1',
            url: 'https://cdn.intercom.io/file1.png',
            name: 'screenshot.png',
            content_type: 'image/png',
            filesize: 204800,
          },
        ],
        created_at: 1700000000,
      },
    ];

    const messages = mapConversationPartsToMessages(parts);

    expect(messages).toHaveLength(1);
    expect(messages[0].attachments).toHaveLength(1);
    expect(messages[0].attachments![0]).toEqual({
      externalId: 'att-1',
      fileName: 'screenshot.png',
      fileType: 'image/png',
      fileSize: 204800,
      url: 'https://cdn.intercom.io/file1.png',
    });
  });

  it('should include messages with only attachments (no body)', () => {
    const parts = [
      {
        id: '200',
        part_type: 'comment',
        body: null,
        author: { type: 'user', id: '2' },
        attachments: [
          {
            id: 'att-2',
            url: 'https://cdn.intercom.io/doc.pdf',
            name: 'report.pdf',
            content_type: 'application/pdf',
            filesize: 102400,
          },
        ],
        created_at: 1700000000,
      },
    ];

    const messages = mapConversationPartsToMessages(parts);

    expect(messages).toHaveLength(1);
    expect(messages[0].body).toBe('');
    expect(messages[0].attachments).toHaveLength(1);
  });

  it('should return undefined attachments when none exist', () => {
    const parts = [
      {
        id: '300',
        part_type: 'comment',
        body: '<p>No attachments here</p>',
        author: { type: 'admin', id: '3' },
        created_at: 1700000000,
      },
    ];

    const messages = mapConversationPartsToMessages(parts);

    expect(messages).toHaveLength(1);
    expect(messages[0].attachments).toBeUndefined();
  });

  it('should map attachments from initial message', () => {
    const conversation = {
      id: '500',
      state: 'open',
      source: {
        body: '<p>Initial message with attachment</p>',
        author: { type: 'user', id: '5', name: 'Bob' },
        attachments: [
          {
            id: 'att-init',
            url: 'https://cdn.intercom.io/initial.pdf',
            name: 'contract.pdf',
            content_type: 'application/pdf',
          },
        ],
      },
      created_at: 1700000000,
      updated_at: 1700000000,
    };

    const msg = mapInitialMessageToNormalized(conversation);

    expect(msg).not.toBeNull();
    expect(msg!.attachments).toHaveLength(1);
    expect(msg!.attachments![0].fileName).toBe('contract.pdf');
  });

  it('should handle multiple attachments on a single message', () => {
    const parts = [
      {
        id: '400',
        part_type: 'comment',
        body: '<p>Multiple files</p>',
        author: { type: 'user', id: '4' },
        attachments: [
          { id: 'a1', url: 'https://cdn.intercom.io/1.png', name: 'one.png', content_type: 'image/png' },
          { id: 'a2', url: 'https://cdn.intercom.io/2.pdf', name: 'two.pdf', content_type: 'application/pdf' },
          { id: 'a3', url: 'https://cdn.intercom.io/3.txt', name: 'three.txt', content_type: 'text/plain' },
        ],
        created_at: 1700000000,
      },
    ];

    const messages = mapConversationPartsToMessages(parts);

    expect(messages[0].attachments).toHaveLength(3);
  });
});

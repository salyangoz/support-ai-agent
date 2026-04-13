import { describe, it, expect } from 'vitest';
import {
  mapConversationToTicket,
  mapConversationPartsToMessages,
} from '../../../src/apps/intercom/intercom.mapper';

describe('Intercom Mapper', () => {
  describe('mapConversationToTicket', () => {
    it('should map a conversation to NormalizedTicket', () => {
      const conversation = {
        id: '12345',
        state: 'open',
        title: 'Help with order',
        source: {
          body: '<p>I need help</p>',
          author: { type: 'user', id: 'user-1', email: 'jane@example.com', name: 'Jane' },
        },
        contacts: {
          contacts: [
            { id: 'user-1', email: 'jane@example.com', name: 'Jane Doe' },
          ],
        },
        assignee: { id: 'admin-1' },
        created_at: 1700000000,
        updated_at: 1700001000,
      };

      const ticket = mapConversationToTicket(conversation);
      expect(ticket.externalId).toBe('12345');
      expect(ticket.state).toBe('open');
      expect(ticket.subject).toBe('Help with order');
      expect(ticket.initialBody).toBe('I need help');
      expect(ticket.customerEmail).toBe('jane@example.com');
      expect(ticket.customerName).toBe('Jane Doe');
    });

    it('should strip HTML from body', () => {
      const conversation = {
        id: '1',
        state: 'open',
        source: {
          body: '<p>Hello <strong>World</strong></p>',
          author: { type: 'user', id: 'u1' },
        },
        created_at: 1700000000,
        updated_at: 1700000000,
      };

      const ticket = mapConversationToTicket(conversation);
      expect(ticket.initialBody).toBe('Hello World');
    });

    it('should handle missing optional fields', () => {
      const conversation = {
        id: '2',
        state: 'closed',
        source: { body: null, author: { type: 'user', id: 'u1' } },
        created_at: 1700000000,
        updated_at: 1700000000,
      };

      const ticket = mapConversationToTicket(conversation);
      expect(ticket.externalId).toBe('2');
      expect(ticket.subject).toBeUndefined();
      expect(ticket.customerEmail).toBeUndefined();
    });

    it('should extract customer from contacts array (new API)', () => {
      const conversation = {
        id: '3',
        state: 'open',
        source: { body: 'test', author: { type: 'user', id: 'u1' } },
        contacts: {
          contacts: [
            { id: 'c1', email: 'test@example.com', name: 'Test User' },
          ],
        },
        created_at: 1700000000,
        updated_at: 1700000000,
      };

      const ticket = mapConversationToTicket(conversation);
      expect(ticket.customerEmail).toBe('test@example.com');
      expect(ticket.customerName).toBe('Test User');
      expect(ticket.customerExternalId).toBe('c1');
    });
  });

  describe('mapConversationPartsToMessages', () => {
    it('should map conversation parts to NormalizedMessages', () => {
      const parts = [
        {
          id: 'part-1',
          part_type: 'comment',
          body: '<p>Reply text</p>',
          author: { type: 'user', id: 'user-1', name: 'Jane' },
          created_at: 1700000000,
        },
        {
          id: 'part-2',
          part_type: 'comment',
          body: '<p>Agent reply</p>',
          author: { type: 'admin', id: 'admin-1', name: 'Agent Tim' },
          created_at: 1700001000,
        },
      ];

      const messages = mapConversationPartsToMessages(parts);
      expect(messages).toHaveLength(2);

      expect(messages[0].externalId).toBe('part-1');
      expect(messages[0].authorRole).toBe('customer');
      expect(messages[0].body).toBe('Reply text');

      expect(messages[1].externalId).toBe('part-2');
      expect(messages[1].authorRole).toBe('agent');
      expect(messages[1].body).toBe('Agent reply');
    });

    it('should skip parts without body', () => {
      const parts = [
        {
          id: 'part-1',
          part_type: 'comment',
          body: null,
          author: { type: 'user', id: 'u1' },
          created_at: 1700000000,
        },
      ];

      const messages = mapConversationPartsToMessages(parts);
      expect(messages).toHaveLength(0);
    });

    it('should map bot author type', () => {
      const parts = [
        {
          id: 'part-1',
          part_type: 'comment',
          body: '<p>Bot response</p>',
          author: { type: 'bot', id: 'bot-1', name: 'Fin' },
          created_at: 1700000000,
        },
      ];

      const messages = mapConversationPartsToMessages(parts);
      expect(messages[0].authorRole).toBe('bot');
    });
  });
});

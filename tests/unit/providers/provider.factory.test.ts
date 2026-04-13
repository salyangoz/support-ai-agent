import { describe, it, expect } from 'vitest';
import { createInputApp, createOutputApp } from '../../../src/apps/app.factory';
import { IntercomInputApp } from '../../../src/apps/intercom/intercom.app';

function buildApp(overrides: Record<string, any> = {}): any {
  return {
    id: 1,
    tenantId: 1,
    code: 'intercom',
    type: 'ticket',
    role: 'both',
    name: null,
    credentials: { accessToken: 'test-token', clientSecret: 'test-secret' },
    webhookSecret: null,
    config: {},
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AppFactory', () => {
  it('should return IntercomInputApp for intercom app code', () => {
    const app = buildApp({ code: 'intercom' });
    const inputApp = createInputApp(app);
    expect(inputApp).toBeInstanceOf(IntercomInputApp);
  });

  it('should throw for unknown app code', () => {
    const app = buildApp({ code: 'unknown' });
    expect(() => createInputApp(app)).toThrow('Unknown app code: unknown');
  });

  it('should create output app for zendesk code', () => {
    const app = buildApp({ code: 'zendesk', credentials: {} });
    const outputApp = createOutputApp(app);
    expect(outputApp).toBeDefined();
  });

  it('should throw when creating InputApp for destination-only app', () => {
    const app = buildApp({ role: 'destination' });
    expect(() => createInputApp(app)).toThrow('destination-only');
  });

  it('should throw when creating OutputApp for source-only app', () => {
    const app = buildApp({ role: 'source' });
    expect(() => createOutputApp(app)).toThrow('source-only');
  });

  it('should throw when creating InputApp for non-ticket app', () => {
    const app = buildApp({ type: 'knowledge' });
    expect(() => createInputApp(app)).toThrow('not a ticket app');
  });
});

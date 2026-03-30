import { describe, it, expect } from 'vitest';
import { createProvider } from '../../../src/providers/provider.factory';
import { IntercomAdapter } from '../../../src/providers/intercom/intercom.adapter';

describe('ProviderFactory', () => {
  it('should return IntercomAdapter for intercom provider', () => {
    const adapter = createProvider({
      provider: 'intercom',
      accessToken: 'test-token',
      clientSecret: 'test-secret',
    });
    expect(adapter).toBeInstanceOf(IntercomAdapter);
  });

  it('should throw for unknown provider', () => {
    expect(() => createProvider({
      provider: 'unknown',
    })).toThrow('Unknown provider: unknown');
  });

  it('should create ZendeskAdapter for zendesk provider', () => {
    const adapter = createProvider({
      provider: 'zendesk',
    });
    expect(adapter).toBeDefined();
  });
});

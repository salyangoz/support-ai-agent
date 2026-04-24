import { describe, it, expect } from 'vitest';
import {
  createInputApp,
  createOutputApp,
  createVoiceSourceApp,
  createTranscriptionApp,
} from '../../../src/apps/app.factory';
import { IntercomInputApp } from '../../../src/apps/intercom/intercom.app';
import { VerimorVoiceApp } from '../../../src/apps/verimor/verimor.app';
import { GladiaTranscriptionApp } from '../../../src/apps/gladia/gladia.app';

function buildApp(overrides: Record<string, any> = {}): any {
  return {
    id: '00000000-0000-7000-0000-000000000001',
    tenantId: '00000000-0000-7000-0000-000000000002',
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

  describe('createVoiceSourceApp', () => {
    it('returns VerimorVoiceApp for verimor code', () => {
      const app = buildApp({
        code: 'verimor',
        type: 'voice',
        role: 'source',
        credentials: { api_key: 'k' },
        config: {},
      });
      expect(createVoiceSourceApp(app)).toBeInstanceOf(VerimorVoiceApp);
    });

    it('throws for non-voice type', () => {
      const app = buildApp({ code: 'verimor', type: 'ticket', role: 'source' });
      expect(() => createVoiceSourceApp(app)).toThrow('not a voice app');
    });

    it('throws for unknown voice code', () => {
      const app = buildApp({
        code: 'not-a-voice-app',
        type: 'voice',
        role: 'source',
        credentials: {},
        config: {},
      });
      expect(() => createVoiceSourceApp(app)).toThrow('Unknown voice app code');
    });
  });

  describe('createTranscriptionApp', () => {
    it('returns GladiaTranscriptionApp for gladia code', () => {
      const app = buildApp({
        code: 'gladia',
        type: 'transcription',
        role: 'source',
        credentials: { api_key: 'k' },
        config: {},
      });
      expect(createTranscriptionApp(app)).toBeInstanceOf(GladiaTranscriptionApp);
    });

    it('throws for non-transcription type', () => {
      const app = buildApp({ code: 'gladia', type: 'voice', role: 'source' });
      expect(() => createTranscriptionApp(app)).toThrow('not a transcription app');
    });

    it('throws for unknown transcription code', () => {
      const app = buildApp({
        code: 'not-a-transcriber',
        type: 'transcription',
        role: 'source',
        credentials: {},
        config: {},
      });
      expect(() => createTranscriptionApp(app)).toThrow('Unknown transcription app code');
    });
  });
});

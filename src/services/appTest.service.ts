import {
  createInputApp,
  createKnowledgeSourceApp,
  createTranscriptionApp,
  createVoiceSourceApp,
} from '../apps/app.factory';
import { App } from '../models/types';

export async function testAppCredentials(app: App): Promise<{ success: boolean; error?: string }> {
  try {
    if (app.type === 'ticket') {
      const adapter = createInputApp(app);
      await adapter.fetchRecentTickets(1);
    } else if (app.type === 'knowledge') {
      const adapter = createKnowledgeSourceApp(app);
      await adapter.fetchArticles();
    } else if (app.type === 'voice') {
      const adapter = createVoiceSourceApp(app);
      // Hitting the CDR endpoint with a 1-minute window validates the api_key.
      await adapter.fetchRecentRecordings(1);
    } else if (app.type === 'transcription') {
      // No read-only auth probe on the providers we support. Submit a POST with
      // an intentionally-bogus audio URL: a valid key returns a 4xx about the
      // URL/payload, an invalid key returns 401/403.
      const adapter = createTranscriptionApp(app);
      try {
        await adapter.transcribe({ audioUrl: 'https://gladia-credential-test.invalid/probe.mp3' });
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          return { success: false, error: 'Authentication failed — check your credentials' };
        }
        // Any other error means the credentials were accepted (submission itself
        // failed downstream, which is expected for the fake URL).
        return { success: true };
      }
      return { success: true };
    } else {
      return { success: true };
    }

    return { success: true };
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      return { success: false, error: 'Authentication failed — check your credentials' };
    }
    return { success: false, error: err.message || 'Connection failed' };
  }
}

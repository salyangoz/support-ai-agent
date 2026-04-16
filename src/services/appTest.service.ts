import { createInputApp, createKnowledgeSourceApp } from '../apps/app.factory';
import { App } from '../models/types';

export async function testAppCredentials(app: App): Promise<{ success: boolean; error?: string }> {
  try {
    if (app.type === 'ticket') {
      const adapter = createInputApp(app);
      // Try fetching recent tickets with a very short lookback — validates auth
      await adapter.fetchRecentTickets(1);
    } else if (app.type === 'knowledge') {
      const adapter = createKnowledgeSourceApp(app);
      await adapter.fetchArticles();
    } else {
      return { success: true }; // notification apps have no test
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

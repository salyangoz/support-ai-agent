import {
  InputApp,
  OutputApp,
  KnowledgeSourceApp,
  TranscriptionApp,
  VoiceSourceApp,
  WebhookEventHandler,
} from './app.interface';
import { IntercomInputApp, IntercomOutputApp } from './intercom/intercom.app';
import { handleEvent as intercomHandleEvent } from './intercom/intercom.webhookHandler';
import { GitHubKnowledgeApp } from './github/github.app';
import { WebScraperApp } from './web-scraper/web-scraper.app';
import { SlackKbApp } from './slack-kb/slack-kb.app';
import { VerimorVoiceApp } from './verimor/verimor.app';
import { GladiaTranscriptionApp } from './gladia/gladia.app';
import { App } from '../models/types';

export function createInputApp(app: App): InputApp {
  if (app.type !== 'ticket') {
    throw new Error(`App ${app.id} is not a ticket app (type: ${app.type})`);
  }
  if (app.role === 'destination') {
    throw new Error(`App ${app.id} is configured as destination-only`);
  }

  const credentials = app.credentials as Record<string, any>;

  switch (app.code) {
    case 'intercom':
      return new IntercomInputApp({
        accessToken: credentials.access_token || credentials.accessToken,
        clientSecret: credentials.client_secret || credentials.clientSecret,
      });
    default:
      throw new Error(`Unknown app code: ${app.code}`);
  }
}

export function createOutputApp(app: App): OutputApp {
  if (app.type !== 'ticket') {
    throw new Error(`App ${app.id} is not a ticket app (type: ${app.type})`);
  }
  if (app.role === 'source') {
    throw new Error(`App ${app.id} is configured as source-only`);
  }

  const credentials = app.credentials as Record<string, any>;

  switch (app.code) {
    case 'intercom': {
      const appConfig = app.config as Record<string, any>;
      return new IntercomOutputApp(
        { accessToken: credentials.access_token || credentials.accessToken },
        { sendAsNote: !!appConfig.send_as_note && appConfig.send_as_note !== 'false', adminId: appConfig.admin_id },
      );
    }
    default:
      throw new Error(`Unknown app code: ${app.code}`);
  }
}

export function createWebhookHandler(app: App): WebhookEventHandler {
  switch (app.code) {
    case 'intercom':
      return intercomHandleEvent;
    default:
      throw new Error(`No webhook handler for app code: ${app.code}`);
  }
}

export function createKnowledgeSourceApp(
  app: App,
  tenantSettings?: Record<string, any>,
): KnowledgeSourceApp {
  if (app.type !== 'knowledge') {
    throw new Error(`App ${app.id} is not a knowledge app (type: ${app.type})`);
  }
  if (app.role === 'destination') {
    throw new Error(`App ${app.id} is configured as destination-only`);
  }

  const credentials = app.credentials as Record<string, any>;

  switch (app.code) {
    case 'github':
      return new GitHubKnowledgeApp({
        token: credentials.token,
        owner: credentials.owner,
        repo: credentials.repo,
        path: credentials.path || '',
        branch: credentials.branch || 'main',
      });
    case 'web-scraper': {
      const appConfig = app.config as Record<string, any>;
      return new WebScraperApp({
        url: credentials.url,
        selector: appConfig.selector,
        maxPages: appConfig.max_pages,
      });
    }
    case 'slack-kb': {
      const appConfig = app.config as Record<string, any>;
      const rawChannelIds = credentials.channel_ids || credentials.channelIds || [];
      const channelIds = Array.isArray(rawChannelIds)
        ? rawChannelIds
        : typeof rawChannelIds === 'string'
          ? rawChannelIds.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];
      return new SlackKbApp({
        botToken: credentials.botToken,
        channelIds,
        minReplies: appConfig.min_replies ? Number(appConfig.min_replies) : undefined,
        lookbackDays: appConfig.lookback_days ? Number(appConfig.lookback_days) : undefined,
        aiService: appConfig.ai_service || tenantSettings?.ai_service,
        aiModel: appConfig.ai_model || tenantSettings?.ai_model,
        aiCredentials: credentials.ai_credentials || tenantSettings?.ai_credentials,
      });
    }
    default:
      throw new Error(`Unknown knowledge app code: ${app.code}`);
  }
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  return fallback;
}

export function createVoiceSourceApp(app: App): VoiceSourceApp {
  if (app.type !== 'voice') {
    throw new Error(`App ${app.id} is not a voice app (type: ${app.type})`);
  }
  if (app.role === 'destination') {
    throw new Error(`App ${app.id} is configured as destination-only`);
  }

  const credentials = app.credentials as Record<string, any>;
  const appConfig = app.config as Record<string, any>;

  switch (app.code) {
    case 'verimor':
      return new VerimorVoiceApp({
        apiKey: credentials.api_key || credentials.apiKey,
        minDurationSeconds: appConfig.min_duration_seconds
          ? Number(appConfig.min_duration_seconds)
          : undefined,
        maxRecordings: appConfig.max_recordings ? Number(appConfig.max_recordings) : undefined,
      });
    default:
      throw new Error(`Unknown voice app code: ${app.code}`);
  }
}

export function createTranscriptionApp(app: App): TranscriptionApp {
  if (app.type !== 'transcription') {
    throw new Error(`App ${app.id} is not a transcription app (type: ${app.type})`);
  }

  const credentials = app.credentials as Record<string, any>;
  const appConfig = app.config as Record<string, any>;

  switch (app.code) {
    case 'gladia':
      return new GladiaTranscriptionApp({
        apiKey: credentials.api_key || credentials.apiKey,
        diarization: toBool(appConfig.diarization, true),
        detectLanguage: toBool(appConfig.detect_language, true),
        defaultLanguage: appConfig.default_language || 'tr',
        summarization: toBool(appConfig.summarization, true),
        sentimentAnalysis: toBool(appConfig.sentiment_analysis, false),
      });
    default:
      throw new Error(`Unknown transcription app code: ${app.code}`);
  }
}

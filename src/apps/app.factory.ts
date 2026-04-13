import { InputApp, OutputApp, KnowledgeSourceApp } from './app.interface';
import { IntercomInputApp, IntercomOutputApp } from './intercom/intercom.app';
import { ZendeskInputApp, ZendeskOutputApp } from './zendesk/zendesk.app';
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
        accessToken: credentials.accessToken,
        clientSecret: credentials.clientSecret,
      });
    case 'zendesk':
      return new ZendeskInputApp(credentials);
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
    case 'intercom':
      return new IntercomOutputApp({
        accessToken: credentials.accessToken,
      });
    case 'zendesk':
      return new ZendeskOutputApp(credentials);
    default:
      throw new Error(`Unknown app code: ${app.code}`);
  }
}

export function createKnowledgeSourceApp(app: App): KnowledgeSourceApp {
  if (app.type !== 'knowledge') {
    throw new Error(`App ${app.id} is not a knowledge app (type: ${app.type})`);
  }
  if (app.role === 'destination') {
    throw new Error(`App ${app.id} is configured as destination-only`);
  }

  switch (app.code) {
    // Future: case 'notion': return new NotionKnowledgeApp(app.credentials, app.config);
    // Future: case 'confluence': return new ConfluenceKnowledgeApp(app.credentials, app.config);
    default:
      throw new Error(`Unknown knowledge app code: ${app.code}`);
  }
}

import { InputApp, OutputApp, KnowledgeSourceApp } from './app.interface';
import { IntercomInputApp, IntercomOutputApp } from './intercom/intercom.app';
import { GitHubKnowledgeApp } from './github/github.app';
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
    default:
      throw new Error(`Unknown knowledge app code: ${app.code}`);
  }
}

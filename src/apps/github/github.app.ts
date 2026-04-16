import axios, { AxiosInstance } from 'axios';
import { KnowledgeSourceApp, NormalizedArticle } from '../app.interface';
import { logger } from '../../utils/logger';

export interface GitHubCredentials {
  token: string;
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

export class GitHubKnowledgeApp implements KnowledgeSourceApp {
  private client: AxiosInstance;
  private owner: string;
  private repo: string;
  private path: string;
  private branch: string;

  constructor(credentials: GitHubCredentials) {
    this.owner = credentials.owner;
    this.repo = credentials.repo;
    this.path = credentials.path;
    this.branch = credentials.branch || 'main';

    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `token ${credentials.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 30_000,
    });
  }

  async fetchArticles(since?: Date): Promise<NormalizedArticle[]> {
    const files = await this.listMarkdownFiles();
    const articles: NormalizedArticle[] = [];

    for (const file of files) {
      try {
        if (since) {
          const hasChanges = await this.hasChangesSince(file.path, since);
          if (!hasChanges) continue;
        }

        const content = await this.fetchFileContent(file.path);
        const title = this.extractTitle(content, file.name);

        articles.push({
          externalId: `github:${this.owner}/${this.repo}/${file.path}`,
          title,
          content,
          category: this.extractCategory(file.path),
          metadata: {
            sha: file.sha,
            html_url: file.html_url,
            source: 'github',
          },
        });
      } catch (err) {
        logger.error('Failed to fetch GitHub file', {
          path: file.path,
          error: (err as Error).message,
        });
      }
    }

    return articles;
  }

  private async listMarkdownFiles(): Promise<any[]> {
    const response = await this.client.get(
      `/repos/${this.owner}/${this.repo}/contents/${this.path}`,
      { params: { ref: this.branch } },
    );

    const items = Array.isArray(response.data) ? response.data : [response.data];
    return items.filter((f: any) => f.type === 'file' && f.name.endsWith('.md'));
  }

  private async fetchFileContent(filePath: string): Promise<string> {
    const response = await this.client.get(
      `/repos/${this.owner}/${this.repo}/contents/${filePath}`,
      { params: { ref: this.branch } },
    );

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    return content;
  }

  private async hasChangesSince(filePath: string, since: Date): Promise<boolean> {
    try {
      const response = await this.client.get(
        `/repos/${this.owner}/${this.repo}/commits`,
        {
          params: {
            path: filePath,
            since: since.toISOString(),
            per_page: 1,
          },
        },
      );
      return response.data.length > 0;
    } catch {
      return true; // on error, fetch anyway
    }
  }

  private extractTitle(content: string, filename: string): string {
    const match = content.match(/^#\s+(.+)/m);
    if (match) return match[1].trim();
    return filename.replace(/\.md$/, '').replace(/[-_]/g, ' ');
  }

  private extractCategory(filePath: string): string {
    const parts = filePath.split('/');
    return parts.length > 1 ? parts[parts.length - 2] : 'general';
  }
}

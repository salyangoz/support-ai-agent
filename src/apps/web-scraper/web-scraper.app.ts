import axios from 'axios';
import * as cheerio from 'cheerio';
import { KnowledgeSourceApp, NormalizedArticle } from '../app.interface';
import { logger } from '../../utils/logger';

export interface WebScraperConfig {
  url: string;
  selector?: string;
  maxPages?: number;
}

const DEFAULT_SELECTOR = 'article, main, .content, .post, .entry-content';
const DEFAULT_MAX_PAGES = 50;
const MAX_PAGES_LIMIT = 200;
const MIN_CONTENT_LENGTH = 50;
const REQUEST_TIMEOUT = 15_000;
const BOILERPLATE_THRESHOLD = 0.3; // sentence appears in 30%+ of pages → boilerplate
const MIN_PAGES_FOR_DETECTION = 3; // need at least 3 pages to detect patterns

export class WebScraperApp implements KnowledgeSourceApp {
  private startUrl: string;
  private origin: string;
  private selector: string;
  private maxPages: number;

  constructor(config: WebScraperConfig) {
    this.startUrl = config.url;
    this.origin = new URL(config.url).origin;
    this.selector = config.selector || DEFAULT_SELECTOR;
    this.maxPages = Math.min(config.maxPages || DEFAULT_MAX_PAGES, MAX_PAGES_LIMIT);
  }

  async fetchArticles(): Promise<NormalizedArticle[]> {
    const visited = new Set<string>();
    const queue: string[] = [this.normalizeUrl(this.startUrl)];
    const articles: NormalizedArticle[] = [];

    while (queue.length > 0 && visited.size < this.maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        const page = await this.crawlPage(url);
        if (!page) continue;

        if (page.content.length >= MIN_CONTENT_LENGTH) {
          articles.push({
            externalId: `web:${url}`,
            title: page.title,
            content: page.content,
            category: this.extractCategory(url),
            metadata: { source: 'web-scraper', url },
          });
        }

        for (const link of page.links) {
          const normalized = this.normalizeUrl(link);
          if (!visited.has(normalized) && !queue.includes(normalized)) {
            queue.push(normalized);
          }
        }
      } catch (err) {
        logger.error('Failed to crawl page', {
          url,
          error: (err as Error).message,
        });
      }
    }

    return this.removeBoilerplate(articles);
  }

  private removeBoilerplate(articles: NormalizedArticle[]): NormalizedArticle[] {
    if (articles.length < MIN_PAGES_FOR_DETECTION) return articles;

    // Split each article into sentences
    const sentencesByArticle = articles.map((a) => this.splitSentences(a.content));

    // Count how many articles each sentence appears in
    const sentenceCounts = new Map<string, number>();
    for (const sentences of sentencesByArticle) {
      const unique = new Set(sentences);
      for (const s of unique) {
        sentenceCounts.set(s, (sentenceCounts.get(s) || 0) + 1);
      }
    }

    // Find boilerplate sentences (appear in 30%+ of articles)
    const threshold = Math.max(2, Math.floor(articles.length * BOILERPLATE_THRESHOLD));
    const boilerplate = new Set<string>();
    for (const [sentence, count] of sentenceCounts) {
      if (count >= threshold) {
        boilerplate.add(sentence);
      }
    }

    if (boilerplate.size === 0) return articles;

    logger.info('Boilerplate sentences detected', {
      count: boilerplate.size,
      examples: [...boilerplate].slice(0, 3),
    });

    // Remove boilerplate from each article
    return articles
      .map((article) => {
        const cleaned = this.splitSentences(article.content)
          .filter((s) => !boilerplate.has(s))
          .join(' ')
          .replace(/^\.\s*/, '')       // leading dot
          .replace(/\s*\.\s*\./g, '.') // double dots
          .replace(/\s+/g, ' ')
          .trim();

        return { ...article, content: cleaned };
      })
      .filter((a) => a.content.length >= MIN_CONTENT_LENGTH);
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }

  private async crawlPage(url: string): Promise<{ title: string; content: string; links: string[] } | null> {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'YengecBot/1.0 (Knowledge Base Indexer)',
        Accept: 'text/html',
      },
      maxRedirects: 3,
    });

    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html')) return null;

    const $ = cheerio.load(response.data);

    // Remove noise elements
    $('script, style, nav, footer, header, iframe, noscript, [role="navigation"], [role="banner"], .sidebar, .menu, .nav').remove();

    const title = this.extractTitle($);
    const content = this.extractContent($);
    const links = this.discoverLinks($, url);

    return { title, content, links };
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    const h1 = $('h1').first().text().trim();
    if (h1) return h1;

    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
    if (ogTitle) return ogTitle;

    const titleTag = $('title').text().trim();
    if (titleTag) return titleTag;

    return 'Untitled';
  }

  private extractContent($: cheerio.CheerioAPI): string {
    let $content = $(this.selector).first();

    if ($content.length === 0) {
      $content = $('body');
    }

    // Get text, collapse whitespace
    return $content
      .text()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private discoverLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const links: string[] = [];

    $('a[href]').each((_, el) => {
      try {
        const href = $(el).attr('href');
        if (!href) return;

        const resolved = new URL(href, baseUrl);

        // Same origin only
        if (resolved.origin !== this.origin) return;

        // Skip non-page resources
        if (/\.(pdf|png|jpg|jpeg|gif|svg|css|js|zip|tar|gz|mp4|mp3)$/i.test(resolved.pathname)) return;

        // Skip CDN/infrastructure paths (e.g. Cloudflare /cdn-cgi/)
        if (/^\/(cdn-cgi|_next|__)\//i.test(resolved.pathname)) return;

        // Skip anchors and query-only variations
        resolved.hash = '';

        links.push(resolved.href);
      } catch {
        // Invalid URL, skip
      }
    });

    return links;
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    parsed.hash = '';
    // Remove trailing slash (except root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  }

  private extractCategory(url: string): string {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return 'general';
  }
}

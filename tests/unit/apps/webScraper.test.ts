import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebScraperApp } from '../../../src/apps/web-scraper/web-scraper.app';

// Mock axios
vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn(),
    },
  };
});

import axios from 'axios';
const mockGet = vi.mocked(axios.get);

function htmlPage(title: string, content: string, links: string[] = []) {
  const linkTags = links.map((l) => `<a href="${l}">Link</a>`).join('\n');
  return {
    data: `
      <html>
        <head><title>${title}</title></head>
        <body>
          <nav><a href="/nav">Nav</a></nav>
          <article>
            <h1>${title}</h1>
            <p>${content}</p>
            ${linkTags}
          </article>
          <footer>Footer</footer>
        </body>
      </html>
    `,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  };
}

describe('WebScraperApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract article from a single page', async () => {
    mockGet.mockResolvedValueOnce(htmlPage(
      'Getting Started',
      'Welcome to our documentation. This is the getting started guide with detailed instructions.',
    ));

    const app = new WebScraperApp({ url: 'https://docs.example.com' });
    const articles = await app.fetchArticles();

    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Getting Started');
    expect(articles[0].content).toContain('Welcome to our documentation');
    expect(articles[0].externalId).toBe('web:https://docs.example.com/');
  });

  it('should follow internal links', async () => {
    mockGet
      .mockResolvedValueOnce(htmlPage(
        'Home',
        'Welcome to docs. This is the home page with enough content to pass the minimum.',
        ['/guide', 'https://external.com/skip'],
      ))
      .mockResolvedValueOnce(htmlPage(
        'Guide',
        'This is the guide page with detailed information about how to use the product.',
      ));

    const app = new WebScraperApp({ url: 'https://docs.example.com' });
    const articles = await app.fetchArticles();

    expect(articles).toHaveLength(2);
    expect(articles[0].title).toBe('Home');
    expect(articles[1].title).toBe('Guide');
  });

  it('should not follow external links', async () => {
    mockGet.mockResolvedValueOnce(htmlPage(
      'Home',
      'Home page content that is long enough to be a valid article for our system.',
      ['https://external.com/page'],
    ));

    const app = new WebScraperApp({ url: 'https://docs.example.com' });
    const articles = await app.fetchArticles();

    expect(articles).toHaveLength(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('should respect maxPages limit', async () => {
    mockGet.mockResolvedValue(htmlPage(
      'Page',
      'Content that is long enough to pass the minimum content length check for articles.',
      ['/a', '/b', '/c', '/d', '/e'],
    ));

    const app = new WebScraperApp({ url: 'https://docs.example.com', maxPages: 2 });
    const articles = await app.fetchArticles();

    expect(articles.length).toBeLessThanOrEqual(2);
  });

  it('should skip pages with short content', async () => {
    mockGet.mockResolvedValueOnce(htmlPage('Short', 'Hi'));

    const app = new WebScraperApp({ url: 'https://docs.example.com' });
    const articles = await app.fetchArticles();

    expect(articles).toHaveLength(0);
  });

  it('should extract category from URL path', async () => {
    mockGet.mockResolvedValueOnce(htmlPage(
      'Auth Guide',
      'This is a comprehensive guide about authentication and authorization in our API.',
    ));

    const app = new WebScraperApp({ url: 'https://docs.example.com/guides/auth' });
    const articles = await app.fetchArticles();

    expect(articles[0].category).toBe('guides');
  });

  it('should strip nav, footer, script elements from content', async () => {
    mockGet.mockResolvedValueOnce({
      data: `
        <html><body>
          <nav>Navigation menu items</nav>
          <script>alert('js')</script>
          <article><h1>Clean</h1><p>This is the actual article content that should be extracted properly.</p></article>
          <footer>Copyright 2026</footer>
        </body></html>
      `,
      headers: { 'content-type': 'text/html' },
    });

    const app = new WebScraperApp({ url: 'https://docs.example.com' });
    const articles = await app.fetchArticles();

    expect(articles[0].content).not.toContain('Navigation menu');
    expect(articles[0].content).not.toContain('alert');
    expect(articles[0].content).not.toContain('Copyright');
    expect(articles[0].content).toContain('actual article content');
  });

  it('should remove boilerplate sentences that repeat across pages', async () => {
    const boilerplate = 'Sign up now and get started for free today.';

    mockGet
      .mockResolvedValueOnce(htmlPage(
        'Page 1',
        `First page has unique content about feature one. ${boilerplate}`,
        ['/page2', '/page3'],
      ))
      .mockResolvedValueOnce(htmlPage(
        'Page 2',
        `Second page has unique content about feature two. ${boilerplate}`,
      ))
      .mockResolvedValueOnce(htmlPage(
        'Page 3',
        `Third page has unique content about feature three. ${boilerplate}`,
      ));

    const app = new WebScraperApp({ url: 'https://docs.example.com' });
    const articles = await app.fetchArticles();

    expect(articles).toHaveLength(3);
    for (const article of articles) {
      expect(article.content).not.toContain('Sign up now');
      expect(article.content).toContain('unique content');
    }
  });

  it('should keep sentences that appear in few pages only', async () => {
    mockGet
      .mockResolvedValueOnce(htmlPage(
        'Page 1',
        'This sentence is unique to page one and should stay in the output.',
        ['/page2', '/page3', '/page4'],
      ))
      .mockResolvedValueOnce(htmlPage(
        'Page 2',
        'This sentence is unique to page two and should also remain here.',
      ))
      .mockResolvedValueOnce(htmlPage(
        'Page 3',
        'This sentence is unique to page three with its own distinct content.',
      ))
      .mockResolvedValueOnce(htmlPage(
        'Page 4',
        'This sentence is unique to page four and has completely different text.',
      ));

    const app = new WebScraperApp({ url: 'https://docs.example.com' });
    const articles = await app.fetchArticles();

    expect(articles).toHaveLength(4);
    expect(articles[0].content).toContain('unique to page one');
    expect(articles[1].content).toContain('unique to page two');
  });
});

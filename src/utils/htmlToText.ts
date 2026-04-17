import { convert } from 'html-to-text';

// Strips image placeholders that Intercom's `display_as=plaintext` mode
// leaves behind (e.g. `[Image "filename.png"]`, `[Image]`). Safe on plain
// text that already lacks them.
const IMAGE_PLACEHOLDER = /\[Image(?:\s+"[^"]*")?\]/g;

export function htmlToText(html: string | null | undefined): string {
  if (!html) {
    return '';
  }

  const text = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
    ],
  });

  return text.replace(IMAGE_PLACEHOLDER, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

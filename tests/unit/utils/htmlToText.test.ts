import { describe, it, expect } from 'vitest';
import { htmlToText } from '../../../src/utils/htmlToText';

describe('htmlToText', () => {
  it('should convert simple HTML to plain text', () => {
    expect(htmlToText('<p>Hello World</p>')).toBe('Hello World');
  });

  it('should strip nested HTML tags', () => {
    const html = '<div><p>Hello <strong>World</strong></p></div>';
    expect(htmlToText(html)).toBe('Hello World');
  });

  it('should handle links by ignoring href', () => {
    const html = '<a href="https://example.com">Click here</a>';
    expect(htmlToText(html)).toBe('Click here');
  });

  it('should skip images', () => {
    const html = '<p>Before<img src="photo.jpg" alt="photo">After</p>';
    expect(htmlToText(html)).toBe('BeforeAfter');
  });

  it('should return empty string for null', () => {
    expect(htmlToText(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(htmlToText(undefined)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(htmlToText('')).toBe('');
  });

  it('should handle plain text without HTML', () => {
    expect(htmlToText('Just plain text')).toBe('Just plain text');
  });

  it('should handle line breaks', () => {
    const html = '<p>Line 1</p><p>Line 2</p>';
    const result = htmlToText(html);
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 2');
  });
});

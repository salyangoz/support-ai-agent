import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GladiaTranscriptionApp } from '../../../src/apps/gladia/gladia.app';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
  },
}));

import axios from 'axios';

const mockGet = vi.fn();
const mockPost = vi.fn();

describe('GladiaTranscriptionApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.create).mockReturnValue({ get: mockGet, post: mockPost } as any);
  });

  it('submits via audio_url and polls until status=done', async () => {
    // POST /pre-recorded returns job id
    mockPost.mockResolvedValueOnce({
      data: { id: 'job-123', result_url: 'pre-recorded/job-123' },
    });
    // First poll returns processing, second returns done
    mockGet
      .mockResolvedValueOnce({ data: { status: 'processing' } })
      .mockResolvedValueOnce({
        data: {
          status: 'done',
          result: {
            transcription: {
              full_transcript: 'hello world',
              languages: ['en'],
              utterances: [
                { start: 0, end: 1, speaker: 0, text: 'hello' },
                { start: 1, end: 2, speaker: 1, text: 'world' },
              ],
            },
            summarization: { results: 'greeting' },
            metadata: { audio_duration: 2 },
          },
        },
      });

    const app = new GladiaTranscriptionApp({
      apiKey: 'k',
      defaultLanguage: 'en',
      detectLanguage: false,
    });

    const result = await app.transcribe({ audioUrl: 'https://audio.test/x.mp3' });

    expect(mockPost).toHaveBeenCalledWith(
      'pre-recorded',
      expect.objectContaining({
        audio_url: 'https://audio.test/x.mp3',
        language: 'en',
      }),
    );
    expect(result.text).toBe('hello world');
    expect(result.summary).toBe('greeting');
    expect(result.language).toBe('en');
    expect(result.segments).toHaveLength(2);
    expect(result.segments?.[0].speaker).toBe('0');
  }, 20_000);

  it('throws transcript_empty when Gladia returns no text', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'job-1', result_url: 'pre-recorded/job-1' } });
    mockGet.mockResolvedValueOnce({
      data: { status: 'done', result: { transcription: { full_transcript: '' } } },
    });

    const app = new GladiaTranscriptionApp({ apiKey: 'k' });
    await expect(app.transcribe({ audioUrl: 'https://audio.test/silent.mp3' })).rejects.toThrow('transcript_empty');
  }, 20_000);

  it('throws a descriptive error when Gladia reports error status', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'job-2', result_url: 'pre-recorded/job-2' } });
    mockGet.mockResolvedValueOnce({
      data: { status: 'error', error_message: 'bad audio' },
    });

    const app = new GladiaTranscriptionApp({ apiKey: 'k' });
    await expect(app.transcribe({ audioUrl: 'https://audio.test/bad.mp3' })).rejects.toThrow(/bad audio/);
  }, 20_000);

  it('throws when api_key is missing', () => {
    expect(() => new GladiaTranscriptionApp({ apiKey: '' })).toThrow(/api_key/);
  });
});

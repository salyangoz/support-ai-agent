import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerimorVoiceApp, formatTurkishPhone } from '../../../src/apps/verimor/verimor.app';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
  },
}));

import axios from 'axios';

const mockGet = vi.fn();
const mockPost = vi.fn();

describe('formatTurkishPhone', () => {
  it('prefixes +90 for numbers starting with 5', () => {
    expect(formatTurkishPhone('5551234567')).toBe('+905551234567');
  });
  it('prefixes + for numbers starting with 90', () => {
    expect(formatTurkishPhone('905551234567')).toBe('+905551234567');
  });
  it('replaces leading 0 with +9', () => {
    expect(formatTurkishPhone('05551234567')).toBe('+905551234567');
  });
  it('keeps already-E.164 numbers', () => {
    expect(formatTurkishPhone('+905551234567')).toBe('+905551234567');
  });
  it('returns undefined for empty', () => {
    expect(formatTurkishPhone('')).toBeUndefined();
    expect(formatTurkishPhone(null)).toBeUndefined();
  });
});

describe('VerimorVoiceApp.fetchRecentRecordings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.create).mockReturnValue({ get: mockGet, post: mockPost } as any);
  });

  function setupTwoDirectionResponses(inboundCdrs: any[], outboundCdrs: any[]) {
    // One GET per direction, each returning a single page.
    mockGet
      .mockResolvedValueOnce({ data: { cdrs: inboundCdrs, pagination: { total_pages: 1, page: 1 } } })
      .mockResolvedValueOnce({ data: { cdrs: outboundCdrs, pagination: { total_pages: 1, page: 1 } } });
  }

  it('fetches inbound + outbound, dedupes by call_uuid, and maps fields', async () => {
    const inbound = [
      {
        call_uuid: 'uuid-inbound-1',
        start_stamp: '2026-04-24 10:15:00',
        talk_duration: 42,
        caller_id_number: '5551234567',
        destination_number: '5009999',
        destination_name: 'Destek',
        direction: 'Gelen',
        result: 'Cevaplandı',
      },
    ];
    const outbound = [
      {
        call_uuid: 'uuid-outbound-1',
        start_stamp: '2026-04-24 10:20:00',
        talk_duration: 30,
        caller_id_number: '5001111',
        destination_number: '905556789012',
        direction: 'Giden',
        result: 'Cevaplandı',
      },
    ];
    setupTwoDirectionResponses(inbound, outbound);

    // /recording_url returns a plain URL string
    mockPost.mockResolvedValue({ data: 'https://cdn.verimor.test/rec1.mp3' });

    const app = new VerimorVoiceApp({ apiKey: 'k' });
    const recordings = await app.fetchRecentRecordings(15);

    expect(recordings).toHaveLength(2);
    const inboundRec = recordings.find((r) => r.externalId === 'uuid-inbound-1')!;
    expect(inboundRec.direction).toBe('inbound');
    expect(inboundRec.caller).toBe('+905551234567');
    expect(inboundRec.durationSeconds).toBe(42);
    expect(inboundRec.audioUrl).toBe('https://cdn.verimor.test/rec1.mp3');
    expect(inboundRec.audioAuthHeaders).toBeUndefined();

    const outboundRec = recordings.find((r) => r.externalId === 'uuid-outbound-1')!;
    expect(outboundRec.direction).toBe('outbound');
    // For outbound, caller = destination_number (the one we called)
    expect(outboundRec.caller).toBe('+905556789012');
  });

  it('skips missed and non-answered calls', async () => {
    const inbound = [
      { call_uuid: 'missed', missed: true, talk_duration: 20, direction: 'Gelen' },
      { call_uuid: 'busy', result: 'Meşgul', talk_duration: 20, direction: 'Gelen' },
      {
        call_uuid: 'good',
        result: 'Cevaplandı',
        talk_duration: 20,
        caller_id_number: '5551234567',
        direction: 'Gelen',
      },
    ];
    setupTwoDirectionResponses(inbound, []);
    mockPost.mockResolvedValue({ data: 'https://cdn.verimor.test/rec.mp3' });

    const app = new VerimorVoiceApp({ apiKey: 'k' });
    const recordings = await app.fetchRecentRecordings(15);
    expect(recordings).toHaveLength(1);
    expect(recordings[0].externalId).toBe('good');
  });

  it('filters calls shorter than min_duration_seconds', async () => {
    const inbound = [
      { call_uuid: 'short', talk_duration: 2, result: 'Cevaplandı', direction: 'Gelen' },
      { call_uuid: 'long', talk_duration: 30, result: 'Cevaplandı', direction: 'Gelen', caller_id_number: '5551234567' },
    ];
    setupTwoDirectionResponses(inbound, []);
    mockPost.mockResolvedValue({ data: 'https://cdn.verimor.test/rec.mp3' });

    const app = new VerimorVoiceApp({ apiKey: 'k', minDurationSeconds: 5 });
    const recordings = await app.fetchRecentRecordings(15);
    expect(recordings.map((r) => r.externalId)).toEqual(['long']);
  });

  it('skips recording when /recording_url returns empty', async () => {
    const inbound = [
      { call_uuid: 'no-url', talk_duration: 30, result: 'Cevaplandı', direction: 'Gelen', caller_id_number: '5551234567' },
    ];
    setupTwoDirectionResponses(inbound, []);
    mockPost.mockResolvedValue({ data: '' });

    const app = new VerimorVoiceApp({ apiKey: 'k' });
    const recordings = await app.fetchRecentRecordings(15);
    expect(recordings).toHaveLength(0);
  });

  it('throws when api_key is missing', () => {
    expect(() => new VerimorVoiceApp({ apiKey: '' })).toThrow(/api_key/);
  });

  it('throws on bad api_key even when Verimor returns HTTP 200 with an error body', async () => {
    mockGet.mockResolvedValueOnce({ data: { error: 'invalid api key' } });
    const app = new VerimorVoiceApp({ apiKey: 'wrong' });
    await expect(app.fetchRecentRecordings(15)).rejects.toThrow(/invalid api key|Verimor rejected/);
  });
});

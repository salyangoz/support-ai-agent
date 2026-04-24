export interface GladiaSubmitResponse {
  id: string;
  result_url?: string;
}

export interface GladiaUtterance {
  start: number;
  end: number;
  speaker?: number | string;
  text: string;
  confidence?: number;
}

export interface GladiaTranscriptionResult {
  id?: string;
  status?: 'queued' | 'processing' | 'done' | 'error' | string;
  result?: {
    transcription?: {
      full_transcript?: string;
      languages?: string[];
      utterances?: GladiaUtterance[];
    };
    summarization?: {
      results?: string;
    };
    metadata?: {
      audio_duration?: number;
      number_of_distinct_channels?: number;
    };
    [key: string]: unknown;
  };
  error_code?: number;
  error_message?: string;
}

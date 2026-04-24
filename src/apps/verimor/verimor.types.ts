export type VerimorDirection = 'inbound' | 'outbound';

export interface VerimorCdr {
  call_uuid: string;
  start_stamp?: string;
  answer_stamp?: string;
  end_stamp?: string;
  duration?: string | number;
  talk_duration?: string | number;
  queue_wait_seconds?: string | number;
  direction?: string;
  caller_id_number?: string;
  caller_id_name?: string;
  destination_number?: string;
  destination_name?: string;
  result?: string;
  missed?: boolean | number | string;
  queue?: string;
  return_uuid?: string;
  [key: string]: unknown;
}

export interface VerimorCdrResponse {
  cdrs?: VerimorCdr[];
  pagination?: {
    page?: number;
    total_pages?: number;
    total_count?: number;
  };
}

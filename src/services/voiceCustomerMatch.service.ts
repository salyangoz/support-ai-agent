import { NormalizedVoiceRecording } from '../apps/app.interface';
import { formatTurkishPhone } from '../apps/verimor/verimor.app';
import * as customerRepo from '../repositories/customer.repository';

function looksLikeEmail(value: string | undefined | null): boolean {
  return !!value && /@/.test(value);
}

function looksLikePhone(value: string | undefined | null): boolean {
  if (!value) return false;
  const digits = String(value).replace(/\D+/g, '');
  return digits.length >= 7;
}

export async function matchCustomer(
  tenantId: string,
  recording: NormalizedVoiceRecording,
) {
  // Explicit email beats anything.
  if (recording.callerEmail) {
    const hit = await customerRepo.findCustomerByEmail(tenantId, recording.callerEmail);
    if (hit) return hit;
  }

  const caller = recording.caller?.trim();
  if (looksLikeEmail(caller)) {
    const hit = await customerRepo.findCustomerByEmail(tenantId, caller!);
    if (hit) return hit;
  }

  if (looksLikePhone(caller)) {
    const normalized = formatTurkishPhone(caller) ?? caller;
    const hit = await customerRepo.findCustomerByPhone(tenantId, normalized!);
    if (hit) return hit;
    // Fall back to raw if normalization changed the value.
    if (normalized !== caller) {
      const rawHit = await customerRepo.findCustomerByPhone(tenantId, caller!);
      if (rawHit) return rawHit;
    }
  }

  return null;
}

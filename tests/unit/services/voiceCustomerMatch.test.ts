import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchCustomer } from '../../../src/services/voiceCustomerMatch.service';

vi.mock('../../../src/repositories/customer.repository', () => ({
  findCustomerByEmail: vi.fn(),
  findCustomerByPhone: vi.fn(),
}));

import * as customerRepo from '../../../src/repositories/customer.repository';

const TENANT_ID = 't1';

describe('matchCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches by explicit callerEmail first', async () => {
    vi.mocked(customerRepo.findCustomerByEmail).mockResolvedValueOnce({ id: 'c1' } as any);
    const result = await matchCustomer(TENANT_ID, {
      externalId: 'x',
      audioUrl: '',
      callerEmail: 'ali@example.com',
      caller: '5551234567',
    });
    expect(result).toEqual({ id: 'c1' });
    expect(customerRepo.findCustomerByEmail).toHaveBeenCalledWith(TENANT_ID, 'ali@example.com');
    expect(customerRepo.findCustomerByPhone).not.toHaveBeenCalled();
  });

  it('detects email in caller field', async () => {
    vi.mocked(customerRepo.findCustomerByEmail).mockResolvedValueOnce({ id: 'c2' } as any);
    const result = await matchCustomer(TENANT_ID, {
      externalId: 'x',
      audioUrl: '',
      caller: 'ali@example.com',
    });
    expect(result).toEqual({ id: 'c2' });
  });

  it('matches by Turkish-normalized phone', async () => {
    vi.mocked(customerRepo.findCustomerByEmail).mockResolvedValue(null);
    vi.mocked(customerRepo.findCustomerByPhone).mockImplementation(async (_tid, phone) => {
      if (phone === '+905551234567') return { id: 'c3' } as any;
      return null;
    });

    const result = await matchCustomer(TENANT_ID, {
      externalId: 'x',
      audioUrl: '',
      caller: '5551234567',
    });
    expect(result).toEqual({ id: 'c3' });
    expect(customerRepo.findCustomerByPhone).toHaveBeenCalledWith(TENANT_ID, '+905551234567');
  });

  it('falls back to raw phone if normalized lookup misses', async () => {
    vi.mocked(customerRepo.findCustomerByPhone).mockImplementation(async (_tid, phone) => {
      if (phone === '5551234567') return { id: 'c4' } as any;
      return null;
    });

    const result = await matchCustomer(TENANT_ID, {
      externalId: 'x',
      audioUrl: '',
      caller: '5551234567',
    });
    expect(result).toEqual({ id: 'c4' });
  });

  it('returns null and does not auto-create when nothing matches', async () => {
    vi.mocked(customerRepo.findCustomerByEmail).mockResolvedValue(null);
    vi.mocked(customerRepo.findCustomerByPhone).mockResolvedValue(null);

    const result = await matchCustomer(TENANT_ID, {
      externalId: 'x',
      audioUrl: '',
      caller: '5551234567',
    });
    expect(result).toBeNull();
  });

  it('skips name-only matching entirely', async () => {
    const result = await matchCustomer(TENANT_ID, {
      externalId: 'x',
      audioUrl: '',
      callerName: 'Ali Veli',
    });
    expect(result).toBeNull();
    expect(customerRepo.findCustomerByEmail).not.toHaveBeenCalled();
    expect(customerRepo.findCustomerByPhone).not.toHaveBeenCalled();
  });
});

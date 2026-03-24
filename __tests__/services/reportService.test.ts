/**
 * Supabase Report Service Tests
 *
 * Tests report submission via Supabase insert.
 * Gets the same mocked supabase instance that the service uses.
 */

import { supabase } from '../../src/lib/supabase';
import * as reportService from '../../src/services/supabase/reportService';

const mockSupabase = supabase as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reportUser', () => {
  it('inserts with correct fields', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });

    await reportService.reportUser('reporter-1', 'reported-2', 'spam');

    expect(mockSupabase.from).toHaveBeenCalledWith('reports');
    expect(mockInsert).toHaveBeenCalledWith({
      reporter_id: 'reporter-1',
      reported_id: 'reported-2',
      reason: 'spam',
      details: null,
    });
  });

  it('throws when reason is empty', async () => {
    await expect(
      reportService.reportUser('reporter-1', 'reported-2', '')
    ).rejects.toThrow('Report reason is required');
  });

  it('includes optional details when provided', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });

    await reportService.reportUser(
      'reporter-1',
      'reported-2',
      'harassment',
      'Sent threatening messages'
    );

    expect(mockInsert).toHaveBeenCalledWith({
      reporter_id: 'reporter-1',
      reported_id: 'reported-2',
      reason: 'harassment',
      details: 'Sent threatening messages',
    });
  });

  it('throws on Supabase error', async () => {
    const mockInsert = jest
      .fn()
      .mockResolvedValue({ error: { message: 'Insert failed' } });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });

    await expect(
      reportService.reportUser('reporter-1', 'reported-2', 'spam')
    ).rejects.toThrow('Insert failed');
  });
});

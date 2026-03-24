/**
 * Message Service Tests (Supabase)
 *
 * Tests all conversation and message operations via Supabase client.
 * Uses the global supabase mock from jest.setup.js with per-test chain overrides.
 */

import { supabase } from '../../src/lib/supabase';

// Logger mock
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  generateConversationId,
  getOrCreateConversation,
  getConversation,
  sendMessage,
  sendReaction,
  removeReaction,
  sendReply,
  sendTaggedPhotoMessage,
  getMessages,
  markConversationRead,
  softDeleteConversation,
  unsendMessage,
  deleteMessageForMe,
} from '../../src/services/supabase/messageService';

const mockSupabase = supabase as any;

// ============================================================================
// Helper: build a chainable mock that resolves at the terminal method
// ============================================================================

function chainMock(terminal: string, resolveValue: any) {
  const chain: any = {};
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'lt',
    'is',
    'in',
    'order',
    'limit',
    'single',
  ];
  for (const m of methods) {
    if (m === terminal) {
      chain[m] = jest.fn().mockResolvedValue(resolveValue);
    } else {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
  }
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// generateConversationId
// ============================================================================

describe('generateConversationId', () => {
  it('sorts IDs alphabetically with lower first', () => {
    expect(generateConversationId('aaa', 'zzz')).toBe('aaa_zzz');
  });

  it('returns same ID regardless of argument order', () => {
    expect(generateConversationId('zzz', 'aaa')).toBe('aaa_zzz');
  });

  it('uses underscore as separator', () => {
    const result = generateConversationId('user-1', 'user-2');
    expect(result).toContain('_');
    expect(result.split('_').length).toBe(2);
  });
});

// ============================================================================
// getOrCreateConversation
// ============================================================================

describe('getOrCreateConversation', () => {
  it('upserts with participant1_id < participant2_id and returns conversation', async () => {
    const mockConversation = {
      id: 'aaa_zzz',
      participant1_id: 'aaa',
      participant2_id: 'zzz',
      created_at: '2026-01-01T00:00:00Z',
    };

    const chain = chainMock('single', { data: mockConversation, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await getOrCreateConversation('zzz', 'aaa');

    expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'aaa_zzz',
        participant1_id: 'aaa',
        participant2_id: 'zzz',
      }),
      { onConflict: 'participant1_id,participant2_id' }
    );
    expect(result).toEqual(mockConversation);
  });

  it('throws on Supabase error', async () => {
    const chain = chainMock('single', {
      data: null,
      error: { message: 'upsert failed' },
    });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    await expect(getOrCreateConversation('a', 'b')).rejects.toThrow(
      'upsert failed'
    );
  });
});

// ============================================================================
// getConversation
// ============================================================================

describe('getConversation', () => {
  it('fetches conversation by ID', async () => {
    const mockConv = { id: 'conv-1', participant1_id: 'a', participant2_id: 'b' };
    const chain = chainMock('single', { data: mockConv, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await getConversation('conv-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
    expect(chain.eq).toHaveBeenCalledWith('id', 'conv-1');
    expect(result).toEqual(mockConv);
  });
});

// ============================================================================
// sendMessage
// ============================================================================

describe('sendMessage', () => {
  it('inserts message with correct defaults and returns messageId', async () => {
    const chain = chainMock('single', {
      data: { id: 'msg-1' },
      error: null,
    });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await sendMessage({
      conversationId: 'conv-1',
      senderId: 'user-1',
      text: 'Hello',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        type: 'text',
        text: 'Hello',
        gif_url: null,
      })
    );
    expect(result).toEqual({ messageId: 'msg-1' });
  });

  it('throws on Supabase error', async () => {
    const chain = chainMock('single', {
      data: null,
      error: { message: 'insert failed' },
    });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    await expect(
      sendMessage({ conversationId: 'c', senderId: 's', text: 'hi' })
    ).rejects.toThrow('insert failed');
  });
});

// ============================================================================
// sendReaction
// ============================================================================

describe('sendReaction', () => {
  it('inserts reaction with type, reply_to_id, and emoji', async () => {
    const chain = chainMock('single', {
      data: { id: 'react-1' },
      error: null,
    });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await sendReaction('conv-1', 'user-1', 'msg-target', 'heart');

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        type: 'reaction',
        reply_to_id: 'msg-target',
        emoji: 'heart',
      })
    );
    expect(result).toEqual({ messageId: 'react-1' });
  });
});

// ============================================================================
// removeReaction
// ============================================================================

describe('removeReaction', () => {
  it('finds active reaction and sets unsent_at', async () => {
    // First call: find the reaction (select chain)
    const findChain = chainMock('single', {
      data: { id: 'react-1' },
      error: null,
    });
    // Second call: update the reaction
    const updateChain = chainMock('eq', { error: null });
    // Need update to return the chain for .eq
    updateChain.update = jest.fn().mockReturnValue(updateChain);

    let callCount = 0;
    mockSupabase.from = jest.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? findChain : updateChain;
    });

    await removeReaction('conv-1', 'user-1', 'msg-target');

    // Verify find query
    expect(findChain.eq).toHaveBeenCalledWith('conversation_id', 'conv-1');
    expect(findChain.eq).toHaveBeenCalledWith('sender_id', 'user-1');
    expect(findChain.eq).toHaveBeenCalledWith('reply_to_id', 'msg-target');
    expect(findChain.eq).toHaveBeenCalledWith('type', 'reaction');

    // Verify update
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ unsent_at: expect.any(String) })
    );
  });
});

// ============================================================================
// sendReply
// ============================================================================

describe('sendReply', () => {
  it('inserts reply with reply_to_id and reply_preview JSONB', async () => {
    const chain = chainMock('single', {
      data: { id: 'reply-1' },
      error: null,
    });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const preview = { sender_id: 'user-2', type: 'text', text: 'original msg' };
    const result = await sendReply({
      conversationId: 'conv-1',
      senderId: 'user-1',
      text: 'my reply',
      replyToId: 'msg-orig',
      replyPreview: preview,
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        type: 'reply',
        text: 'my reply',
        reply_to_id: 'msg-orig',
        reply_preview: preview,
      })
    );
    expect(result).toEqual({ messageId: 'reply-1' });
  });
});

// ============================================================================
// sendTaggedPhotoMessage
// ============================================================================

describe('sendTaggedPhotoMessage', () => {
  it('inserts tagged_photo message with tagged_photo_id', async () => {
    const chain = chainMock('single', {
      data: { id: 'tag-1' },
      error: null,
    });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await sendTaggedPhotoMessage('conv-1', 'user-1', 'photo-99');

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        type: 'tagged_photo',
        tagged_photo_id: 'photo-99',
      })
    );
    expect(result).toEqual({ messageId: 'tag-1' });
  });
});

// ============================================================================
// markConversationRead
// ============================================================================

describe('markConversationRead', () => {
  it('updates last_read_at_p1 when user is participant1', async () => {
    // First from() call: getConversation (select)
    const convChain = chainMock('single', {
      data: { id: 'conv-1', participant1_id: 'user-a', participant2_id: 'user-b' },
      error: null,
    });
    // Second from() call: update
    const updateChain = chainMock('eq', { error: null });
    updateChain.update = jest.fn().mockReturnValue(updateChain);

    let callCount = 0;
    mockSupabase.from = jest.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? convChain : updateChain;
    });

    await markConversationRead('conv-1', 'user-a');

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_read_at_p1: expect.any(String),
        unread_count_p1: 0,
      })
    );
  });

  it('updates last_read_at_p2 when user is participant2', async () => {
    const convChain = chainMock('single', {
      data: { id: 'conv-1', participant1_id: 'user-a', participant2_id: 'user-b' },
      error: null,
    });
    const updateChain = chainMock('eq', { error: null });
    updateChain.update = jest.fn().mockReturnValue(updateChain);

    let callCount = 0;
    mockSupabase.from = jest.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? convChain : updateChain;
    });

    await markConversationRead('conv-1', 'user-b');

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_read_at_p2: expect.any(String),
        unread_count_p2: 0,
      })
    );
  });

  it('resets unread count for correct participant', async () => {
    const convChain = chainMock('single', {
      data: {
        id: 'conv-1',
        participant1_id: 'user-a',
        participant2_id: 'user-b',
        unread_count_p1: 5,
      },
      error: null,
    });
    const updateChain = chainMock('eq', { error: null });
    updateChain.update = jest.fn().mockReturnValue(updateChain);

    let callCount = 0;
    mockSupabase.from = jest.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? convChain : updateChain;
    });

    await markConversationRead('conv-1', 'user-a');

    const updateArg = updateChain.update.mock.calls[0][0];
    expect(updateArg.unread_count_p1).toBe(0);
    expect(updateArg).not.toHaveProperty('unread_count_p2');
  });
});

// ============================================================================
// softDeleteConversation
// ============================================================================

describe('softDeleteConversation', () => {
  it('sets deleted_at for correct participant', async () => {
    const convChain = chainMock('single', {
      data: { id: 'conv-1', participant1_id: 'user-a', participant2_id: 'user-b' },
      error: null,
    });
    const updateChain = chainMock('eq', { error: null });
    updateChain.update = jest.fn().mockReturnValue(updateChain);

    let callCount = 0;
    mockSupabase.from = jest.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? convChain : updateChain;
    });

    await softDeleteConversation('conv-1', 'user-b');

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at_p2: expect.any(String),
      })
    );
  });
});

// ============================================================================
// unsendMessage
// ============================================================================

describe('unsendMessage', () => {
  it('sets unsent_at timestamp on message', async () => {
    const chain = chainMock('eq', { error: null });
    chain.update = jest.fn().mockReturnValue(chain);
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    await unsendMessage('msg-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ unsent_at: expect.any(String) })
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'msg-1');
  });
});

// ============================================================================
// deleteMessageForMe
// ============================================================================

describe('deleteMessageForMe', () => {
  it('inserts into message_deletions with message_id and user_id', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from = jest.fn().mockReturnValue({ insert: mockInsert });

    await deleteMessageForMe('msg-1', 'user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('message_deletions');
    expect(mockInsert).toHaveBeenCalledWith({
      message_id: 'msg-1',
      user_id: 'user-1',
    });
  });

  it('throws on Supabase error', async () => {
    const mockInsert = jest
      .fn()
      .mockResolvedValue({ error: { message: 'Duplicate' } });
    mockSupabase.from = jest.fn().mockReturnValue({ insert: mockInsert });

    await expect(deleteMessageForMe('msg-1', 'user-1')).rejects.toThrow(
      'Duplicate'
    );
  });
});

// ============================================================================
// getMessages
// ============================================================================

describe('getMessages', () => {
  it('fetches messages and filters out deleted-for-me', async () => {
    const messages = [
      { id: 'msg-1', conversation_id: 'conv-1', created_at: '2026-01-01T00:01:00Z' },
      { id: 'msg-2', conversation_id: 'conv-1', created_at: '2026-01-01T00:00:00Z' },
    ];
    const deletions = [{ message_id: 'msg-2' }];

    // First from() call: messages query (thenable chain)
    const msgChain: any = {};
    for (const m of ['select', 'eq', 'lt', 'is', 'in', 'order', 'limit']) {
      msgChain[m] = jest.fn().mockReturnValue(msgChain);
    }
    msgChain.then = (resolve: any) => resolve({ data: messages, error: null });

    // Second from() call: message_deletions query
    const delChain: any = {};
    delChain.select = jest.fn().mockReturnValue(delChain);
    delChain.eq = jest.fn().mockReturnValue(delChain);
    delChain.in = jest.fn().mockResolvedValue({ data: deletions, error: null });

    let callCount = 0;
    mockSupabase.from = jest.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? msgChain : delChain;
    });

    const result = await getMessages('conv-1', 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('msg-1');
  });

  it('uses cursor for pagination', async () => {
    // The query is built as: .from().select().eq().order().limit() then .lt()
    // All methods must be chainable; final await resolves the promise-like chain
    const msgChain: any = {};
    const resolvedValue = { data: [], error: null };
    const methods = ['select', 'eq', 'lt', 'is', 'in', 'order', 'limit'];
    for (const m of methods) {
      msgChain[m] = jest.fn().mockReturnValue(msgChain);
    }
    // Make the chain thenable so `await query` resolves
    msgChain.then = (resolve: any) => resolve(resolvedValue);

    mockSupabase.from = jest.fn().mockReturnValue(msgChain);

    await getMessages('conv-1', 'user-1', {
      cursor: '2026-01-01T00:00:00Z',
      limit: 10,
    });

    expect(msgChain.lt).toHaveBeenCalledWith(
      'created_at',
      '2026-01-01T00:00:00Z'
    );
    expect(msgChain.limit).toHaveBeenCalledWith(10);
  });
});

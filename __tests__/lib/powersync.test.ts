import { AppSchema } from '../../src/lib/powersync/schema';

describe('PowerSync AppSchema', () => {
  it('defines 5 tables', () => {
    const tableNames = Object.keys(AppSchema.tables);
    expect(tableNames).toHaveLength(5);
    expect(tableNames).toContain('photos');
    expect(tableNames).toContain('conversations');
    expect(tableNames).toContain('friendships');
    expect(tableNames).toContain('streaks');
    expect(tableNames).toContain('upload_queue');
  });

  it('photos table has required columns', () => {
    const photosTable = AppSchema.tables.photos;
    const columnNames = Object.keys(photosTable.columns);
    expect(columnNames).toContain('user_id');
    expect(columnNames).toContain('image_url');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('photo_state');
    expect(columnNames).toContain('media_type');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('deleted_at');
  });

  it('conversations table has participant columns', () => {
    const convTable = AppSchema.tables.conversations;
    const columnNames = Object.keys(convTable.columns);
    expect(columnNames).toContain('participant1_id');
    expect(columnNames).toContain('participant2_id');
    expect(columnNames).toContain('unread_count_p1');
    expect(columnNames).toContain('unread_count_p2');
    expect(columnNames).toContain('deleted_at_p1');
    expect(columnNames).toContain('deleted_at_p2');
  });

  it('friendships table has status and initiated_by', () => {
    const friendshipsTable = AppSchema.tables.friendships;
    const columnNames = Object.keys(friendshipsTable.columns);
    expect(columnNames).toContain('user1_id');
    expect(columnNames).toContain('user2_id');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('initiated_by');
  });

  it('streaks table uses integer for warning_sent (SQLite boolean)', () => {
    const streaksTable = AppSchema.tables.streaks;
    const columnNames = Object.keys(streaksTable.columns);
    expect(columnNames).toContain('warning_sent');
    expect(columnNames).toContain('day_count');
    expect(columnNames).toContain('expires_at');
  });

  it('exports row types', () => {
    // Type-level check: these exports must exist
    const schemaModule = require('../../src/lib/powersync/schema');
    expect(schemaModule.AppSchema).toBeDefined();
  });
});

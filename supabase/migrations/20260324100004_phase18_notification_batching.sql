-- Migration: Phase 18 notification batching drain and receipt checking
-- Creates process_pending_notifications() function and pg_cron schedules
-- for notification batching (every 30s) and push receipt checking (every 5min)

-- ============================================================================
-- 1. process_pending_notifications() -- JOBS-07 drain
--    Runs every 30 seconds via pg_cron. Groups pending_notifications entries
--    by target_user_id + source_user_id + type, sends batched notifications
--    via the send-push-notification Edge Function, then deletes processed rows.
-- ============================================================================

CREATE OR REPLACE FUNCTION process_pending_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  batch RECORD;
BEGIN
  -- Group pending notifications older than 30 seconds by target+source+type
  -- The 30-second window allows accumulation before sending (debounce)
  FOR batch IN
    SELECT
      target_user_id,
      source_user_id,
      type,
      jsonb_agg(payload ORDER BY created_at) AS payloads,
      COUNT(*) AS entry_count,
      array_agg(id) AS ids
    FROM pending_notifications
    WHERE created_at <= NOW() - INTERVAL '30 seconds'
    GROUP BY target_user_id, source_user_id, type
    LIMIT 100
  LOOP
    -- Send batched notification via Edge Function
    -- Type mapping:
    --   'reaction' -> 'reaction_batch' (always batched)
    --   'tag' with count > 1 -> 'tag_batch'
    --   'tag' with count = 1 -> 'tag' (single)
    PERFORM net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', CASE
          WHEN batch.type = 'reaction' THEN 'reaction_batch'
          WHEN batch.type = 'tag' AND batch.entry_count > 1 THEN 'tag_batch'
          WHEN batch.type = 'tag' THEN 'tag'
          ELSE batch.type
        END,
        'user_id', batch.target_user_id,
        'data', jsonb_build_object(
          'source_user_id', batch.source_user_id,
          'count', batch.entry_count,
          'payloads', batch.payloads
        )
      ),
      timeout_milliseconds := 5000
    );

    -- Delete processed entries
    DELETE FROM pending_notifications WHERE id = ANY(batch.ids);
  END LOOP;
END;
$$;

-- ============================================================================
-- 2. pg_cron schedules
-- ============================================================================

-- Process pending notifications every 30 seconds (sub-minute schedule)
SELECT cron.schedule(
  'process-pending-notifications',
  '30 seconds',
  'SELECT process_pending_notifications()'
);

-- Check push receipts every 5 minutes (calls Edge Function)
SELECT cron.schedule(
  'check-push-receipts',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.edge_function_url') || '/check-push-receipts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  )$$
);

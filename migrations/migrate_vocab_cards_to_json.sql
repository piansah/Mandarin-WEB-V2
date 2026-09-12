-- Migration: Add kalimat_parts and vocab_parts columns to modul_module_parts
-- Step 1: Add new columns to modul_module_parts
ALTER TABLE modul_module_parts 
ADD COLUMN IF NOT EXISTS kalimat_parts jsonb,
ADD COLUMN IF NOT EXISTS vocab_parts jsonb;

-- Step 2: Initialize kalimat_parts with empty cards structure
UPDATE modul_module_parts 
SET kalimat_parts = '{"cards": []}'::jsonb
WHERE kalimat_parts IS NULL;

-- Step 3: Migrate existing vocab_cards to vocab_parts JSON (only if table exists)
-- This aggregates all vocab cards for each module_part_id into JSON
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'modul_vocab_cards') THEN
    WITH vocab_migration AS (
      SELECT 
        module_part_id,
        jsonb_agg(
          jsonb_build_object(
            'hanzi', hanzi,
            'pinyin', pinyin,
            'translation', translation,
            'order_index', order_index
          ) ORDER BY order_index
        ) as cards_array
      FROM modul_vocab_cards
      GROUP BY module_part_id
    )
    UPDATE modul_module_parts 
    SET vocab_parts = jsonb_build_object('cards', vm.cards_array)
    FROM vocab_migration vm
    WHERE modul_module_parts.id = vm.module_part_id;
    
    -- Step 4: Delete the old modul_vocab_cards table
    DROP TABLE IF EXISTS modul_vocab_cards CASCADE;
  END IF;
END $$;

-- Step 5: Initialize vocab_parts with empty cards if it's still null
UPDATE modul_module_parts 
SET vocab_parts = '{"cards": []}'::jsonb
WHERE vocab_parts IS NULL;

-- Step 6: Initialize content with empty paragraphs if it's null
UPDATE modul_module_parts 
SET content = '{"paragraphs": []}'::jsonb
WHERE content IS NULL;

-- Step 7: Remove part_type column (not needed since quiz is separate)
ALTER TABLE modul_module_parts 
DROP COLUMN IF EXISTS part_type;

-- Note: The 'content' column is kept for paragraphs (Content section)
-- Order: Content (paragraphs) -> Vocab (cards) -> Kalimat (example sentences)
-- All parts are content pages - quiz is handled separately in modul_quizzes table

-- Performance Indexes for Dashboard and Query Optimization
-- These indexes will significantly improve query performance for the most common queries

-- Index for user_scores queries (dashboard stats, recent activity)
-- Covers queries filtering by user_id, type, and ordering by updated_at
CREATE INDEX IF NOT EXISTS idx_user_scores_user_type_updated 
ON user_scores(user_id, type, updated_at DESC);

-- Index for user_card_progress queries (SRS stats, deck progress)
-- Covers queries filtering by user_id
CREATE INDEX IF NOT EXISTS idx_user_card_progress_user 
ON user_card_progress(user_id);

-- Index for user_card_progress next_review queries (due cards)
-- Covers queries filtering by user_id and next_review
CREATE INDEX IF NOT EXISTS idx_user_card_progress_user_next_review 
ON user_card_progress(user_id, next_review);

-- Index for daily_streaks queries (streak calculation)
-- Covers queries filtering by user_id and date
CREATE INDEX IF NOT EXISTS idx_daily_streaks_user_date 
ON daily_streaks(user_id, date);

-- Index for flashcard_cards queries (deck loading)
-- Covers queries filtering by set_id
CREATE INDEX IF NOT EXISTS idx_flashcard_cards_set_id 
ON flashcard_cards(set_id);

-- Index for hanzi_items queries (estafet loading)
-- Covers queries filtering by hanzi_key
CREATE INDEX IF NOT EXISTS idx_hanzi_items_hanzi_key 
ON hanzi_items(hanzi_key);

-- Index for user_profile queries (display name)
-- Covers queries filtering by user_id
CREATE INDEX IF NOT EXISTS idx_user_profile_user_id 
ON user_profile(user_id);

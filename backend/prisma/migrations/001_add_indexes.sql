-- Add indexes for performance optimization
-- This migration adds indexes to improve query performance

-- Index for Room table
CREATE INDEX IF NOT EXISTS "idx_room_created_at" ON "Room"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_room_id" ON "Room"("id");

-- Indexes for Comment table
CREATE INDEX IF NOT EXISTS "idx_comment_room_id" ON "Comment"("roomId");
CREATE INDEX IF NOT EXISTS "idx_comment_room_line" ON "Comment"("roomId", "lineNumber");
CREATE INDEX IF NOT EXISTS "idx_comment_created_at" ON "Comment"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_comment_user_id" ON "Comment"("userId");

-- Add updatedAt timestamps if they don't exist
DO $$
BEGIN
    -- Add updatedAt to Room table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'Room' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Room" ADD COLUMN "updatedAt" DateTime DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    -- Add updatedAt to Comment table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'Comment' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Comment" ADD COLUMN "updatedAt" DateTime DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create trigger for automatic updatedAt updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to both tables
DROP TRIGGER IF EXISTS update_room_updated_at ON "Room";
CREATE TRIGGER update_room_updated_at 
    BEFORE UPDATE ON "Room" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comment_updated_at ON "Comment";
CREATE TRIGGER update_comment_updated_at 
    BEFORE UPDATE ON "Comment" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

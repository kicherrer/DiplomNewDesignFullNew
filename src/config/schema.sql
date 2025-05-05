-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_id INTEGER,
  views_count INTEGER DEFAULT 0,
  favorites_count INTEGER DEFAULT 0,
  watchlist_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User avatars table
CREATE TABLE IF NOT EXISTS user_avatars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for avatar_id
ALTER TABLE users
  ADD CONSTRAINT fk_user_avatar
  FOREIGN KEY (avatar_id)
  REFERENCES user_avatars(id)
  ON DELETE SET NULL;

CREATE TABLE verification_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(4) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notification_email BOOLEAN DEFAULT TRUE,
  notification_web BOOLEAN DEFAULT TRUE,
  privacy_profile BOOLEAN DEFAULT FALSE,
  theme VARCHAR(50) DEFAULT 'light',
  language VARCHAR(10) DEFAULT 'ru'
);

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  location VARCHAR(255),
  website VARCHAR(255),
  social_links JSONB DEFAULT '{"twitter": "", "instagram": "", "telegram": ""}'::jsonb
);

-- Media content
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  content_url TEXT NOT NULL,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, media_id)
);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, media_id)
);

-- View history
CREATE TABLE IF NOT EXISTS history (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  watch_duration INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, media_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id);

-- Create or update function for user statistics
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET
      views_count = (SELECT COUNT(*) FROM history WHERE user_id = NEW.user_id),
      favorites_count = (SELECT COUNT(*) FROM favorites WHERE user_id = NEW.user_id),
      watchlist_count = (SELECT COUNT(*) FROM watchlist WHERE user_id = NEW.user_id)
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET
      views_count = (SELECT COUNT(*) FROM history WHERE user_id = OLD.user_id),
      favorites_count = (SELECT COUNT(*) FROM favorites WHERE user_id = OLD.user_id),
      watchlist_count = (SELECT COUNT(*) FROM watchlist WHERE user_id = OLD.user_id)
    WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for statistics
DROP TRIGGER IF EXISTS update_stats_history ON history;
DROP TRIGGER IF EXISTS update_stats_favorites ON favorites;
DROP TRIGGER IF EXISTS update_stats_watchlist ON watchlist;

CREATE TRIGGER update_stats_history
AFTER INSERT OR DELETE ON history
FOR EACH ROW
EXECUTE FUNCTION update_user_stats();

CREATE TRIGGER update_stats_favorites
AFTER INSERT OR DELETE ON favorites
FOR EACH ROW
EXECUTE FUNCTION update_user_stats();

CREATE TRIGGER update_stats_watchlist
AFTER INSERT OR DELETE ON watchlist
FOR EACH ROW
EXECUTE FUNCTION update_user_stats();

CREATE TABLE watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE viewing_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL,
  watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  watch_duration INTEGER
);
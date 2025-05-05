export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  views_count: number;
  favorites_count: number;
  watchlist_count: number;
  created_at: Date;
  updated_at: Date;
  settings: UserSettings | null;
  viewing_history: ViewingHistory[];
  favorites: Favorites[];
  watchlist: Watchlist[];
  role: 'USER' | 'ADMIN';
}

export interface UserSettings {
  id: number;
  user_id: number;
  notification_email: boolean;
  notification_web: boolean;
  privacy_profile: boolean;
  theme: string;
  language: string;
}

export interface ViewingHistory {
  id: number;
  user_id: number;
  media_id: number;
  created_at: string;
}

export interface Favorites {
  id: number;
  user_id: number;
  media_id: number;
  created_at: string;
}

export interface Watchlist {
  id: number;
  user_id: number;
  media_id: number;
  created_at: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  views_count: number;
  favorites_count: number;
  watchlist_count: number;
  created_at: Date;
  updated_at: Date;
  role: 'USER' | 'ADMIN';
}
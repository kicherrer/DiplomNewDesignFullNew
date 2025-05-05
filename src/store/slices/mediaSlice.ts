import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MediaItem {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  rating: number;
}

interface MediaState {
  items: MediaItem[];
  favorites: number[];
  watchlist: number[];
  loading: boolean;
  error: string | null;
}

const initialState: MediaState = {
  items: [],
  favorites: [],
  watchlist: [],
  loading: false,
  error: null,
};

const mediaSlice = createSlice({
  name: 'media',
  initialState,
  reducers: {
    setItems: (state, action: PayloadAction<MediaItem[]>) => {
      state.items = action.payload;
    },
    addToFavorites: (state, action: PayloadAction<number>) => {
      if (!state.favorites.includes(action.payload)) {
        state.favorites.push(action.payload);
      }
    },
    removeFromFavorites: (state, action: PayloadAction<number>) => {
      state.favorites = state.favorites.filter(id => id !== action.payload);
    },
    addToWatchlist: (state, action: PayloadAction<number>) => {
      if (!state.watchlist.includes(action.payload)) {
        state.watchlist.push(action.payload);
      }
    },
    removeFromWatchlist: (state, action: PayloadAction<number>) => {
      state.watchlist = state.watchlist.filter(id => id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setItems,
  addToFavorites,
  removeFromFavorites,
  addToWatchlist,
  removeFromWatchlist,
  setLoading,
  setError,
} = mediaSlice.actions;

export default mediaSlice.reducer;
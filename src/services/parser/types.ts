export interface KinopoiskMovie {
  filmId: number;
  nameRu: string | null;
  nameOriginal: string | null;
  type: 'FILM' | 'TV_SERIES';
  year: number | null;
  description: string | null;
  posterUrl: string | null;
  coverUrl: string | null;
  ratingKinopoisk: number | null;
  filmLength: number | null;
  genres: Array<{ genre: string }> | null;
}

export interface OmdbMovie {
  imdbID: string;
  Title: string;
  Year: string;
  Type: string;
  Poster: string;
  Plot: string;
  imdbRating: string;
  Runtime: string;
  Genre: string;
}
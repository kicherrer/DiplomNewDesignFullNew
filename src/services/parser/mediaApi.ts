import axios from 'axios';

export interface KinopoiskMovie {
  kinopoiskId: number;
  filmId: number;
  nameRu: string;
  nameEn: string | null;
  nameOriginal: string | null;
  posterUrl: string;
  posterUrlPreview: string;
  coverUrl: string | null;
  logoUrl: string | null;
  reviewsCount: number;
  ratingKinopoisk: number | null;
  ratingImdb: number | null;
  type: 'FILM' | 'TV_SERIES';
  year: number;
  description: string | null;
  shortDescription: string | null;
  countries: Array<{ country: string }>;
  genres: Array<{ genre: string }>;
  filmLength: number | null;
  webUrl: string;
  slogan: string | null;
  imdbId: string | null;
  premiereRu: string | null;
  distributors: string | null;
  premiereWorld: string | null;
  ageRating: number | null;
  error?: {
    code: number;
    message: string;
  };
}

interface OmdbMovie {
  Title: string;
  Year: string;
  Rated: string | 'N/A';
  Released: string | 'N/A';
  Runtime: string | 'N/A';
  Genre: string | 'N/A';
  Director: string | 'N/A';
  Writer: string | 'N/A';
  Actors: string | 'N/A';
  Plot: string | 'N/A';
  Poster: string | 'N/A';
  Ratings: Array<{ Source: string; Value: string }>;
  imdbRating: string | 'N/A';
  imdbVotes: string | 'N/A';
  imdbID: string;
  Type: 'movie' | 'series' | 'episode';
  DVD: string | 'N/A';
  BoxOffice: string | 'N/A';
  Production: string | 'N/A';
  Website: string | 'N/A';
  Response: 'True' | 'False';
}

export class MediaApi {
  private kinopoiskApi: string;
  private omdbApi: string;

  constructor(kinopoiskApiKey: string, omdbApiKey: string) {
    this.kinopoiskApi = kinopoiskApiKey;
    this.omdbApi = omdbApiKey;
  }

  async searchKinopoisk(query: string): Promise<Partial<KinopoiskMovie>[]> {
    try {
      const response = await axios.get('https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword', {
        headers: {
          'X-API-KEY': this.kinopoiskApi,
          'Content-Type': 'application/json',
        },
        params: {
          keyword: query,
          page: 1
        }
      });

      if (!response.data || !Array.isArray(response.data.films)) {
        throw new Error('Некорректный формат ответа от API Кинопоиска');
      }

      return response.data.films;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Ошибка API Кинопоиска (${statusCode}): ${errorMessage}`);
      }
      console.error('Kinopoisk search error:', error);
      throw new Error('Ошибка при поиске в Кинопоиске');
    }
  }

  async getKinopoiskDetails(id: number): Promise<KinopoiskMovie> {
    try {
      const response = await axios.get(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${id}`, {
        headers: {
          'X-API-KEY': this.kinopoiskApi,
          'Content-Type': 'application/json',
        }
      });

      return response.data;
    } catch (error) {
      console.error('Kinopoisk details error:', error);
      throw new Error('Ошибка при получении деталей фильма из Кинопоиска');
    }
  }

  async searchOmdb(query: string): Promise<OmdbMovie[]> {
    try {
      const response = await axios.get('http://www.omdbapi.com/', {
        params: {
          apikey: this.omdbApi,
          s: query,
          type: 'movie,series'
        }
      });

      if (response.data.Response === 'False') {
        return [];
      }

      return response.data.Search;
    } catch (error) {
      console.error('OMDB search error:', error);
      throw new Error('Ошибка при поиске в OMDB');
    }
  }

  async getOmdbDetails(imdbId: string): Promise<OmdbMovie> {
    try {
      const response = await axios.get('http://www.omdbapi.com/', {
        params: {
          apikey: this.omdbApi,
          i: imdbId,
          plot: 'full'
        }
      });

      if (response.data.Response === 'False') {
        throw new Error('Фильм не найден');
      }

      return response.data;
    } catch (error) {
      console.error('OMDB details error:', error);
      throw new Error('Ошибка при получении деталей фильма из OMDB');
    }
  }

  async getSeriesEpisodes(kinopoiskId: number): Promise<Array<{ seasonNumber: number; number: number; episodes: Array<{ episodeNumber: number; nameRu: string | null; nameEn: string | null; synopsis: string | null; releaseDate: string | null }> }>> {
    try {
      const response = await axios.get(
        `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kinopoiskId}/seasons`,
        {
          headers: {
            'X-API-KEY': this.kinopoiskApi,
            'Content-Type': 'application/json',
          }
        }
      );

      return response.data.items || [];
    } catch (error) {
      console.error('Series episodes error:', error);
      throw new Error('Ошибка при получении информации о сериях');
    }
  }
}
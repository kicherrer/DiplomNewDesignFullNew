import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import FormData from 'form-data';
import { VideoType, VideoStatus } from '@prisma/client';
import { TorrentProcessor } from './torrentProcessor';

interface QBittorrentConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

interface DoodStreamConfig {
  apiKey: string;
  baseUrl: string;
}

interface TMDBConfig {
  apiKey: string;
  baseUrl: string;
}

interface TorrentData {
  title: string;
  size: number;
  seeders: number;
  quality: VideoQuality;
  language: string;
  magnet?: string;
  torrentFile?: Buffer;
}

type VideoQuality = '4K' | '1080p' | 'FullHD' | 'HD' | '720p' | '480p' | 'unknown';

interface VideoContentData {
  url: string;
  quality: string;
  type: VideoType;
  status: VideoStatus;
  size?: number;
  format: string;
}

export class PublicContentProvider {
  private readonly rutorBaseUrl = 'http://rutor.info';
  private readonly nnmBaseUrl = 'https://nnmclub.to';
  private readonly qbittorrentConfig: QBittorrentConfig;
  private readonly doodStreamConfig: DoodStreamConfig;
  private readonly tmdbConfig: TMDBConfig;
  private readonly tempDir: string;
  private readonly outputDir: string;
  private readonly torrentProcessor: TorrentProcessor;
  private readonly retryDelay: number = 2000; // Base delay for retry operations (2 seconds)

  constructor(
    qbittorrentConfig: QBittorrentConfig,
    doodStreamConfig: DoodStreamConfig,
    tempDir: string = '/tmp/torrents',
    outputDir: string = '/tmp/videos'
  ) {
    this.qbittorrentConfig = qbittorrentConfig;
    this.doodStreamConfig = doodStreamConfig;
    this.tmdbConfig = {
      apiKey: 'd28e3e354a667f829236ce6e5a5441d7',
      baseUrl: 'https://api.themoviedb.org/3'
    };
    this.tempDir = tempDir;
    this.outputDir = outputDir;
    this.torrentProcessor = new TorrentProcessor(tempDir, outputDir);
    
    // Проверяем валидность API ключа при инициализации
    this.validateDoodStreamApiKey().catch(error => {
      console.error('Ошибка при проверке API ключа DoodStream:', error);
    });
  }

  private async validateDoodStreamApiKey(): Promise<boolean> {
    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 2000; // Базовая задержка 2 секунды

    while (retryCount < maxRetries) {
      try {
        // Проверяем формат API ключа
        if (!this.doodStreamConfig.apiKey || this.doodStreamConfig.apiKey.length < 20) {
          throw new Error('Неверный формат API ключа DoodStream');
        }

        // Делаем тестовый запрос к API с таймаутом и заголовками
        const response = await axios.get(`${this.doodStreamConfig.baseUrl}/api/account/info?key=${this.doodStreamConfig.apiKey}`, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          validateStatus: (status) => status >= 200 && status < 500
        });

        // Проверяем статус ответа
        if (response.status === 403) {
          throw new Error('Ошибка авторизации: недействительный API ключ');
        }

        if (response.data.status === 200 && response.data.msg === 'OK') {
          console.log('API ключ DoodStream успешно проверен');
          return true;
        } else {
          throw new Error(`Ошибка проверки API ключа: ${response.data.msg}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        retryCount++;

        if (retryCount < maxRetries) {
          // Экспоненциальная задержка с случайным компонентом
          const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;
          console.log(`Попытка ${retryCount}/${maxRetries} проверки API ключа не удалась: ${errorMessage}`);
          console.log(`Ожидание ${(delay / 1000).toFixed(3)} секунд перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('API ключ DoodStream недействителен после всех попыток:', errorMessage);
          return false;
        }
      }
    }
    return false;
  }

  async searchContent(query: string, originalTitle: string | null = null, isRussianDub: boolean = true): Promise<VideoContentData[]> {
    try {
      console.log(`Начинаем поиск контента для: ${query}${originalTitle ? ` (оригинальное название: ${originalTitle})` : ''}`);
      
      // Получаем информацию о фильме из TMDB
      let releaseYear: number | null = null;
      try {
        const tmdbResponse = await axios.get(`${this.tmdbConfig.baseUrl}/search/movie`, {
          params: {
            api_key: this.tmdbConfig.apiKey,
            query: originalTitle || query,
            language: 'ru-RU'
          }
        });

        if (tmdbResponse.data.results.length > 0) {
          const movie = tmdbResponse.data.results[0];
          const releaseDate = new Date(movie.release_date);
          if (!isNaN(releaseDate.getTime())) {
            releaseYear = releaseDate.getFullYear();
            console.log(`Год выхода по данным TMDB: ${releaseYear}`);
          }
        }
      } catch (error) {
        console.error('Ошибка при получении информации из TMDB:', error);
      }

      // Поиск по основному названию с учетом года
      let torrents = await this.searchTorrents(releaseYear ? `${query} ${releaseYear}` : query, isRussianDub, originalTitle);
      console.log(`Найдено ${torrents.length} торрентов по основному названию`);

      // Если не найдено по основному названию и есть оригинальное, пробуем по нему
      if (torrents.length === 0 && originalTitle) {
        console.log('Пробуем поиск по оригинальному названию...');
        const originalTitleTorrents = await this.searchTorrents(releaseYear ? `${originalTitle} ${releaseYear}` : originalTitle, isRussianDub, query);
        torrents = originalTitleTorrents;
        console.log(`Найдено ${torrents.length} торрентов по оригинальному названию`);
      }

      if (torrents.length === 0) {
        console.log('Торренты не найдены ни по одному из названий');
        return [];
      }

      console.log('Выбираем лучший торрент из найденных...');
      const bestTorrent = await this.selectBestTorrent(torrents, originalTitle, query);
      if (!bestTorrent) {
        console.log('Не удалось выбрать подходящий торрент');
        return [];
      }
      console.log(`Выбран торрент: ${bestTorrent.title} (качество: ${bestTorrent.quality}, сиды: ${bestTorrent.seeders})`);

      console.log('Начинаем загрузку и обработку торрента...');
      const videoPath = await this.downloadAndProcessTorrent(bestTorrent);
      if (!videoPath) {
        console.log('Не удалось загрузить или обработать торрент');
        return [];
      }
      console.log('Торрент успешно загружен и обработан');

      const isSeries = this.isSeries(bestTorrent.title);
      console.log(`Загружаем ${isSeries ? 'сериал' : 'фильм'} на DoodStream...`);
      const uploadResult = await this.uploadToDoodStream(videoPath, isSeries);
      if (!uploadResult) {
        console.log('Не удалось загрузить видео на DoodStream');
        return [];
      }
      console.log('Видео успешно загружено на DoodStream');

      // Удаляем локальный файл после успешной загрузки
      try {
        if (fs.existsSync(videoPath)) {
          await fs.promises.unlink(videoPath);
          console.log(`Локальный файл успешно удален: ${videoPath}`);
        }
      } catch (error) {
        console.error('Ошибка при удалении локального файла:', error);
      }

      return [uploadResult];
    } catch (error) {
      console.error('Ошибка при поиске контента:', error);
      return [];
    }
  }

  private async searchTorrents(query: string, isRussianDub: boolean = true, originalTitle: string | null = null): Promise<TorrentData[]> {
    const results: TorrentData[] = [];

    try {
      // Подготовка поисковых запросов с улучшенной обработкой
      const searchQueries = [];
      
      // Добавляем основной запрос
      searchQueries.push(query);
      
      // Добавляем вариации с оригинальным названием
      if (originalTitle) {
        searchQueries.push(originalTitle);
        // Добавляем комбинированный запрос для более точного поиска
        searchQueries.push(`${query} ${originalTitle}`);
      }

      // Улучшенная очистка и нормализация запросов
      const cleanQueries = searchQueries.map(q => {
        // Базовая очистка от специальных символов
        let cleaned = q.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, ' ');
        // Удаление множественных пробелов
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        // Удаление общих слов, которые могут мешать поиску
        cleaned = cleaned.replace(/\b(the|a|an|и|в|на)\b/gi, ' ');
        return cleaned.trim();
      }).filter(q => q.length > 2); // Фильтруем слишком короткие запросы

      for (const cleanQuery of cleanQueries) {
        console.log(`Выполняем поиск для запроса: ${cleanQuery}`);

        // Сначала ищем на Rutor
        try {
          console.log('Поиск на Rutor...');
          const rutorResults = await this.searchRutor(cleanQuery, isRussianDub);
          console.log(`Найдено ${rutorResults.length} результатов на Rutor`);
          
          // Если нашли подходящие торренты на Rutor, не ищем на других источниках
          if (rutorResults.length > 0) {
            const validTorrents = rutorResults.filter(t => 
              t.seeders > 0 && 
              t.quality !== 'unknown' && 
              t.size > 0
            );
            
            if (validTorrents.length > 0) {
              console.log('Найдены подходящие торренты на Rutor, пропускаем поиск на других источниках');
              return validTorrents;
            }
          }
          
          results.push(...rutorResults);
        } catch (error) {
          console.error('Ошибка при поиске на Rutor:', error);
        }

        // Ищем на NNM-Club только если не нашли на Rutor
        try {
          console.log('Поиск на NNM-Club...');
          const nnmResults = await this.searchNNM(cleanQuery, isRussianDub);
          console.log(`Найдено ${nnmResults.length} результатов на NNM-Club`);
          results.push(...nnmResults);
        } catch (error) {
          console.error('Ошибка при поиске на NNM-Club:', error);
        }
      }

      // Удаляем дубликаты по названию
      const uniqueResults = results.filter((result, index, self) =>
        index === self.findIndex((t) => t.title === result.title)
      );

      console.log(`Всего найдено уникальных результатов: ${uniqueResults.length}`);
      return uniqueResults;
    } catch (error) {
      console.error('Ошибка при поиске торрентов:', error);
      return results;
    }
  }

  private async searchRutor(query: string, isRussianDub: boolean): Promise<TorrentData[]> {
    try {
      const results: TorrentData[] = [];
      let page = 0;
      let hasMorePages = true;

      while (hasMorePages && page < 5) { // Ограничиваем поиск первыми 5 страницами
        const searchUrl = `${this.rutorBaseUrl}/search/${page}/0/000/0/${encodeURIComponent(query)}`;
        console.log(`Поиск на странице ${page + 1}: ${searchUrl}`);

        const response = await axios.get(searchUrl, {
          headers: this.getDefaultHeaders(),
          timeout: 15000, // Увеличиваем таймаут
          maxRedirects: 5,
          validateStatus: (status: number): boolean => status >= 200 && status < 500,
        });

        if (response.status === 404) {
          console.log('Страница не найдена, завершаем поиск');
          break;
        }

        const $ = cheerio.load(response.data);
        let foundResults = false;

        // Проверяем наличие таблицы с результатами
        const table = $('#index');
        if (!table.length) {
          console.log('Таблица с результатами не найдена');
          break;
        }

        $('tr:has(td:nth-child(2))').each((_, element) => {
          const row = $(element);
          // Пропускаем заголовок таблицы
          if (row.find('th').length > 0) return;

          const titleElement = row.find('td:nth-child(2) a').last();
          const title = titleElement.text().trim();
          // Ищем magnet-ссылку среди всех ссылок в ячейке
          const magnetLink = row.find('td:nth-child(2) a[href^="magnet:"]').attr('href');
          const sizeText = row.find('td:nth-child(4)').text().trim();
          const seedersText = row.find('td:nth-child(5)').text().trim();

          if (title && magnetLink) {
            foundResults = true;
            const quality = this.detectQuality(title);
            const isRussian = this.isRussianContent(title);
            const size = this.parseSize(sizeText);
            const seeders = parseInt(seedersText) || 0;

            // Улучшенная фильтрация результатов
            if ((!isRussianDub || isRussian) && 
                quality !== 'unknown' && 
                size > 0 && 
                seeders > 0) {
              results.push({
                title,
                size,
                seeders,
                quality,
                language: isRussian ? 'russian' : 'original',
                magnet: magnetLink
              });
            }
          }
        });

        // Проверяем, есть ли ссылка на следующую страницу
        const nextPageLink = $('a:contains("следующая")').length > 0;
        hasMorePages = foundResults && nextPageLink;
        page++;

        // Добавляем небольшую задержку между запросами
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Найдено ${results.length} результатов на Rutor`);
      return results;
    } catch (error) {
      console.error('Ошибка при поиске на Rutor:', error);
      return [];
    }
  }

  private async searchNNM(query: string, isRussianDub: boolean): Promise<TorrentData[]> {
    try {
      const searchUrl = `${this.nnmBaseUrl}/forum/tracker.php?nm=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: this.getDefaultHeaders(),
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const results: TorrentData[] = [];

      $('tr.prow1, tr.prow2').each((_, element) => {
        const titleElement = $(element).find('td.pcatHead a.genmed');
        const title = titleElement.text().trim();
        const detailsLink = titleElement.attr('href');
        const sizeText = $(element).find('td:nth-child(6)').text().trim();
        const seedersText = $(element).find('td:nth-child(8)').text().trim();

        if (title && detailsLink) {
          const quality = this.detectQuality(title);
          const isRussian = this.isRussianContent(title);

          if ((!isRussianDub || isRussian) && quality !== 'unknown') {
            results.push({
              title,
              size: this.parseSize(sizeText),
              seeders: parseInt(seedersText) || 0,
              quality,
              language: isRussian ? 'russian' : 'original'
            });
          }
        }
      });

      return results;
    } catch (error) {
      console.error('Ошибка при поиске на NNM-Club:', error);
      return [];
    }
  }

  private isSeries(title: string): boolean {
    const seriesPatterns = [
      /сезон/i,
      /серии?/i,
      /episode/i,
      /season/i,
      /s\d{1,2}e\d{1,2}/i,
      /\[\s*\d+\s*-\s*\d+\s*\]/
    ];
    return seriesPatterns.some(pattern => pattern.test(title));
  }

  private extractYear(title: string): number | null {
    const yearMatch = title.match(/[\(\[](\d{4})[\)\]]/); 
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (year >= 1900 && year <= new Date().getFullYear() + 1) {
        return year;
      }
    }
    return null;
  }

  private async selectBestTorrent(torrents: TorrentData[], originalTitle: string | null = null, query: string | null = null): Promise<TorrentData | null> {
    if (!torrents || torrents.length === 0) return null;

    // Проверяем существование фильма и его дату релиза через TMDB API
    try {
      const searchQuery = query || originalTitle || torrents[0].title;
      const tmdbResponse = await axios.get(`${this.tmdbConfig.baseUrl}/search/movie`, {
        params: {
          api_key: this.tmdbConfig.apiKey,
          query: searchQuery,
          language: 'ru-RU'
        }
      });

      if (tmdbResponse.data.results.length === 0) {
        console.log('Фильм не найден в базе TMDB');
        return null;
      }

      const movie = tmdbResponse.data.results[0];
      const releaseDate = new Date(movie.release_date);
      const currentDate = new Date();

      // Проверяем корректность даты релиза
      if (!movie.release_date || isNaN(releaseDate.getTime())) {
        console.log('Некорректная дата релиза в данных TMDB');
        return null;
      }

      // Если дата релиза в будущем или год релиза больше текущего, не выбираем торрент
      if (releaseDate > currentDate || releaseDate.getFullYear() > currentDate.getFullYear()) {
        console.log(`Фильм еще не вышел. Дата релиза: ${movie.release_date}`);
        console.log('Предотвращена попытка загрузки будущего релиза');
        return null;
      }

      // Проверяем соответствие года
      const movieYear = releaseDate.getFullYear();
      const allowedYears = [movieYear - 1, movieYear, movieYear + 1]; // Допускаем погрешность в 1 год

      // Фильтруем торренты по году
      torrents = torrents.filter(torrent => {
        const torrentYear = this.extractYear(torrent.title);
        return torrentYear && allowedYears.includes(torrentYear);
      });

      if (torrents.length === 0) {
        console.log('Не найдено торрентов с соответствующим годом выпуска');
        return null;
      }
    } catch (error) {
      console.error('Ошибка при проверке информации о фильме:', error);
      // В случае ошибки API, продолжаем с имеющимися торрентами
    }

    // Фильтруем торренты по размеру для фильмов (не более 5 ГБ)
    const maxSizeForMovies = 5 * 1024 * 1024 * 1024; // 5 ГБ в байтах
    const filteredTorrents = torrents.filter(torrent => {
      if (this.isSeries(torrent.title)) {
        return true; // Для сериалов пропускаем все размеры
      }
      return torrent.size <= maxSizeForMovies; // Для фильмов ограничиваем размер
    });

    if (filteredTorrents.length === 0) {
      console.log('Не найдено торрентов подходящего размера');
      return null;
    }

    // Добавляем оценку соответствия оригинальному названию
    const torrentsWithScore = filteredTorrents.map(torrent => {
      let titleScore = 0;
      const normalizedTitle = torrent.title.toLowerCase();
      
      // Проверяем соответствие оригинальному названию
      if (originalTitle) {
        const normalizedOriginal = originalTitle.toLowerCase();
        
        // Извлекаем основное название и альтернативное название (если есть)
        const titleParts = normalizedTitle.split(/\s*[\/\|]\s*/).map(part => part.trim());
        const cleanTitleParts = titleParts.map(part => {
          // Удаляем все в скобках и после них
          const cleanPart = part.split(/[\(\[\{]/).map(p => p.trim())[0];
          // Удаляем все после тире или двоеточия
          return cleanPart.split(/[-:]/).map(p => p.trim())[0];
        });
        const cleanOriginal = normalizedOriginal.split(/[\(\[\{\-:]/).map(part => part.trim())[0];

        // Проверяем точное соответствие с любой частью названия
        const hasExactMatch = cleanTitleParts.some(part => {
          const partWords = part.split(/\s+/);
          const originalWords = cleanOriginal.split(/\s+/);
          return partWords.length === originalWords.length && 
                 partWords.every((word, index) => word === originalWords[index]);
        });

        if (hasExactMatch) {
          titleScore += 30; // Повышенный приоритет для точного совпадения
        } else {
          // Проверяем, является ли оригинальное название самостоятельным словом
          const titleWords = cleanTitleParts.flatMap(part => part.split(/\s+/));
          const originalWords = cleanOriginal.split(/\s+/);
          
          // Строгая проверка на точное совпадение слов
          const exactWordMatches = originalWords.filter(word => 
            titleWords.some(titleWord => titleWord === word)
          ).length;

          // Рассчитываем процент точного совпадения слов
          const exactMatchRatio = exactWordMatches / originalWords.length;
          titleScore += exactMatchRatio * 20;

          // Значительный штраф за дополнительные слова
          const extraWords = titleWords.length - originalWords.length;
          if (extraWords > 0) {
            titleScore -= extraWords * 3; // Увеличенный штраф за лишние слова
          }

          // Расширенный список нежелательных слов
          const unwantedWords = [
            'and', 'saints', 'sinners', 'collection', 'anthology',
            'complete', 'series', 'season', 'episode', 'part',
            'volume', 'vol', 'edition', 'extended', 'cut',
            'remastered', 'directors', 'special', 'bonus'
          ];
          
          // Подсчет количества нежелательных слов
          const unwantedWordCount = titleWords.filter(word =>
            unwantedWords.some(unwanted => word.includes(unwanted.toLowerCase()))
          ).length;

          // Прогрессивный штраф за каждое нежелательное слово
          if (unwantedWordCount > 0) {
            titleScore -= unwantedWordCount * 10;
          }

          // Дополнительный штраф за сильное несоответствие длины
          if (titleWords.length > originalWords.length * 2) {
            titleScore -= 20;
          }
        }
      }

      return {
        ...torrent,
        year: this.extractYear(torrent.title),
        titleScore
      };
    });

    const yearCounts = new Map<number, number>();
    torrentsWithScore.forEach(torrent => {
      if (torrent.year) {
        yearCounts.set(torrent.year, (yearCounts.get(torrent.year) || 0) + 1);
      }
    });

    let targetYear: number | null = null;
    let maxCount = 0;
    yearCounts.forEach((count, year) => {
      if (count > maxCount) {
        maxCount = count;
        targetYear = year;
      }
    });

    // Определяем оптимальные размеры для разных качеств
    const getOptimalSizeRange = (quality: VideoQuality): { min: number; max: number } => {
      const GB = 1024 * 1024 * 1024;
      switch (quality) {
        case '4K': return { min: 2 * GB, max: 5 * GB };
        case '1080p': return { min: 1.5 * GB, max: 4 * GB };
        case 'FullHD': return { min: 1.5 * GB, max: 4 * GB };
        case 'HD': return { min: 1 * GB, max: 3 * GB };
        case '720p': return { min: 0.7 * GB, max: 2.5 * GB };
        case '480p': return { min: 0.5 * GB, max: 1.5 * GB };
        default: return { min: 0.5 * GB, max: 5 * GB };
      }
    };

    const sortedTorrents = torrentsWithScore.sort((a, b) => {
      // Приоритет по соответствию оригинальному названию
      const titleScoreDiff = b.titleScore - a.titleScore;
      if (titleScoreDiff !== 0) return titleScoreDiff;

      // Приоритет по году выпуска
      if (targetYear) {
        const aYearMatch = a.year === targetYear;
        const bYearMatch = b.year === targetYear;
        if (aYearMatch && !bYearMatch) return -1;
        if (!aYearMatch && bYearMatch) return 1;
      }

      // Приоритет по качеству
      const qualityOrder = {
        '4K': 6,
        '1080p': 5,
        'FullHD': 4,
        'HD': 3,
        '720p': 2,
        '480p': 1,
        'unknown': 0
      };

      const qualityDiff = qualityOrder[b.quality] - qualityOrder[a.quality];
      if (qualityDiff !== 0) return qualityDiff;

      // Проверка оптимального размера для качества
      const aRange = getOptimalSizeRange(a.quality);
      const bRange = getOptimalSizeRange(b.quality);
      const aOptimal = a.size >= aRange.min && a.size <= aRange.max;
      const bOptimal = b.size >= bRange.min && b.size <= bRange.max;

      if (aOptimal && !bOptimal) return -1;
      if (!bOptimal && aOptimal) return 1;

      // Приоритет по количеству сидов
      const seedersDiff = b.seeders - a.seeders;
      if (seedersDiff !== 0) return seedersDiff;

      // Если все остальные параметры равны, выбираем меньший размер
      return a.size - b.size;
    });

    const bestTorrent = sortedTorrents[0];
    console.log(`Выбран торрент: ${bestTorrent.title} (качество: ${bestTorrent.quality}, размер: ${(bestTorrent.size / (1024 * 1024 * 1024)).toFixed(2)} ГБ, сиды: ${bestTorrent.seeders})`);
    return bestTorrent;
  }

  private async downloadAndProcessTorrent(torrent: TorrentData): Promise<string | null> {
    try {
      if (!torrent.magnet && !torrent.torrentFile) {
        throw new Error('Missing magnet link or torrent file');
      }
      const torrentSource = torrent.magnet || torrent.torrentFile;
      if (!torrentSource) {
        throw new Error('Invalid torrent source');
      }

      // Проверяем размер файла для фильмов (не сериалов)
      if (!this.isSeries(torrent.title)) {
        const sizeGB = torrent.size / (1024 * 1024 * 1024);
        if (sizeGB > 5) {
          console.log(`Пропускаем фильм ${torrent.title}, так как его размер (${sizeGB.toFixed(2)} ГБ) превышает лимит в 5 ГБ`);
          return null;
        }
      }

      return await this.torrentProcessor.processTorrent(torrentSource, this.qbittorrentConfig);
    } catch (error) {
      console.error('Ошибка при обработке торрента:', error);
      return null;
    }
  }

  private async validateDoodStreamAuth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.doodStreamConfig.baseUrl}/api/account/info`, {
        params: { key: this.doodStreamConfig.apiKey },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000
      });

      return response.data?.status === 200 && response.data?.msg === 'OK';
    } catch (error) {
      return false;
    }
  }

  private async uploadToDoodStream(videoPath: string, isSeries: boolean = false): Promise<VideoContentData | null> {
    try {
      if (!fs.existsSync(videoPath)) {
        console.error(`Файл ${videoPath} не существует`);
        return null;
      }

      // Константы для управления загрузкой
      const MAX_CHUNK_SIZE = 100 * 1024 * 1024; // 100 МБ максимальный размер части
      const MAX_CONCURRENT_UPLOADS = 3; // Максимальное количество одновременных загрузок
      const maxRetries = 5; // Максимальное количество попыток для каждой части
      const baseRetryDelay = 5000; // Базовая задержка между попытками (5 секунд)

      // Проверяем авторизацию
      const isAuthorized = await this.validateDoodStreamAuth();
      if (!isAuthorized) {
        console.error('Ошибка авторизации DoodStream. Проверьте API ключ.');
        return null;
      }

      // Проверяем доступное место в хранилище DoodStream
      try {
        const accountInfo = await axios.get(`${this.doodStreamConfig.baseUrl}/api/account/info`, {
          params: { key: this.doodStreamConfig.apiKey },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        if (accountInfo.data.result?.storage?.used_percent > 95) {
          console.error('Недостаточно места в хранилище DoodStream (>95% использовано)');
          return null;
        }
      } catch (error) {
        console.error('Не удалось проверить состояние хранилища DoodStream:', error);
        // Продолжаем загрузку, так как ошибка проверки не критична
      }

      const stats = await fs.promises.stat(videoPath);
      const fileSizeGB = stats.size / (1024 * 1024 * 1024);
      
      // Проверяем размер файла в зависимости от типа контента
      if (!isSeries && fileSizeGB > 5) {
        console.error('Размер фильма превышает 5 ГБ, что не поддерживается DoodStream');
        return null;
      }

      let uploadedUrl: string | null = null;
      let retryCount = 0;
      let storageChecked = false;
      const totalSize = stats.size;

      console.log(`Размер файла: ${(totalSize / (1024 * 1024)).toFixed(2)} МБ`);

      // Проверка доступного места на сервере с экспоненциальной задержкой
      while (!storageChecked && retryCount < maxRetries) {
        try {
          const response = await axios.get(`${this.doodStreamConfig.baseUrl}/account/info?key=${this.doodStreamConfig.apiKey}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            timeout: 30000, // 30 секунд таймаут
            validateStatus: (status) => status === 200 || status === 403 // Принимаем успешный статус и ошибку авторизации
          });

          if (response.status === 403) {
            throw new Error('Ошибка авторизации DoodStream');
          }

          if (!response.data) {
            throw new Error('Пустой ответ от сервера');
          }

          const responseData = response.data as { status: number; storage?: { used: number; total: number } };

          if (responseData.status === 200 && responseData.storage) {
            if (responseData.storage.used >= responseData.storage.total) {
              console.error('Недостаточно места на сервере DoodStream');
              return null;
            }
            storageChecked = true;
            console.log('Успешно проверено доступное место на сервере');
          } else {
            throw new Error(`Неверный ответ от сервера: ${JSON.stringify(responseData)}`);
          }


        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Попытка ${retryCount + 1}/${maxRetries} проверки места на сервере не удалась:`, errorMessage);
          
          retryCount++;
          if (retryCount < maxRetries) {
            const currentDelay = baseRetryDelay * Math.pow(2, retryCount);
            const jitter = Math.floor(Math.random() * 2000);
            const finalDelay = currentDelay + jitter;
            
            console.log(`Ожидание ${finalDelay / 1000} секунд перед следующей попыткой...`);
            await new Promise(resolve => setTimeout(resolve, finalDelay));
          } else {
            console.warn('Превышено максимальное количество попыток проверки места на сервере');
            // Продолжаем загрузку даже если не удалось проверить место
            storageChecked = true;
          }
        }
      }

      // Функция для загрузки одной части файла
      const uploadChunk = async (start: number, end: number, chunkIndex: number, totalChunks: number): Promise<string | null> => {
        let chunkRetries = 0;
        const chunkSize = end - start;

        while (chunkRetries < maxRetries) {
          try {
            // Проверяем авторизацию перед каждой попыткой загрузки
            if (chunkRetries > 0) {
              const isAuthorized = await this.validateDoodStreamAuth();
              if (!isAuthorized) {
                throw new Error('Ошибка авторизации DoodStream');
              }
            }

            console.log(`Загрузка части ${chunkIndex + 1}/${totalChunks} (${(chunkSize / (1024 * 1024)).toFixed(2)} МБ)`);            
            const formData = new FormData();
            formData.append('api_key', this.doodStreamConfig.apiKey);
            formData.append('file', fs.createReadStream(videoPath, { start, end: end - 1 }));

            const uploadUrl = `${this.doodStreamConfig.baseUrl}/upload`;
            const uploadConfig = {
              headers: {
                ...formData.getHeaders(),
                'Content-Length': String(chunkSize),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
              maxBodyLength: MAX_CHUNK_SIZE + 1024 * 1024,
              timeout: 3600000,
              validateStatus: (status: number) => status >= 200 && status < 500,
              maxRedirects: 5,
              decompress: true,
              onUploadProgress: (progressEvent: any) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                console.log(`Прогресс загрузки части ${chunkIndex + 1}: ${percentCompleted}%`);
              }
            };

            const response = await axios.post(uploadUrl, formData, uploadConfig);

            // Обработка различных статусов ответа
            if (response.status === 403) {
              throw new Error('Ошибка авторизации DoodStream');
            }

            if (response.status === 413) {
              throw new Error('Превышен максимальный размер запроса');
            }

            if (response.status >= 400) {
              throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }

            if (!response.data) {
              throw new Error('Пустой ответ от сервера');
            }

            const uploadResponse = response.data as { status: number; result?: { embed_url: string }; msg?: string };
            
            if (uploadResponse.status === 200 && uploadResponse.result?.embed_url) {
              console.log(`Часть ${chunkIndex + 1}/${totalChunks} успешно загружена`);
              return uploadResponse.result.embed_url;
            }

            if (uploadResponse.msg) {
              throw new Error(`Ошибка DoodStream: ${uploadResponse.msg}`);
            }

            throw new Error(`Неожиданный ответ сервера: ${JSON.stringify(response.data)}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Ошибка при загрузке части ${chunkIndex + 1} (попытка ${chunkRetries + 1}/${maxRetries}):`, errorMessage);
            
            chunkRetries++;
            if (chunkRetries < maxRetries) {
              const delay = baseRetryDelay * Math.pow(2, chunkRetries) + Math.random() * 1000;
              console.log(`Ожидание ${(delay / 1000).toFixed(1)} секунд перед следующей попыткой...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        return null;
      };

      // Сбрасываем счетчик попыток для загрузки файла
      retryCount = 0;

      // Если файл меньше максимального размера части, загружаем его целиком
      if (totalSize <= MAX_CHUNK_SIZE) {
        while (retryCount < maxRetries && !uploadedUrl) {
          try {
            // Вычисляем адаптивную задержку с экспоненциальным ростом
            const currentDelay = baseRetryDelay * Math.pow(2, retryCount);
            const jitter = Math.floor(Math.random() * 2000); // Добавляем случайную составляющую
            const finalDelay = currentDelay + jitter;

            const formData = new FormData();
            formData.append('api_key', this.doodStreamConfig.apiKey);
            formData.append('file', fs.createReadStream(videoPath));

            const response = await axios.post(`${this.doodStreamConfig.baseUrl}/upload`, formData, {
              headers: {
                ...formData.getHeaders(),
                'Content-Length': String(totalSize),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
              maxBodyLength: MAX_CHUNK_SIZE + 1024 * 1024, // Добавляем буфер для метаданных
              timeout: 3600000, // 1 час таймаут
              validateStatus: (status) => status === 200 || status === 403 || status === 413, // Обрабатываем специфические статусы
              maxRedirects: 5,
              decompress: true
            });

            if (response.status === 403) {
              throw new Error('Ошибка авторизации DoodStream. Проверьте API ключ.');
            }

            if (response.status === 413) {
              console.error('Ошибка: Превышен максимальный размер запроса');
              throw new Error('Превышен максимальный размер запроса');
            }

            if (!response.data) {
              throw new Error('Пустой ответ от сервера');
            }

            const uploadResponse = response.data as { status: number; result?: { embed_url: string }; msg?: string };
            
            if (uploadResponse.status === 200 && uploadResponse.result?.embed_url) {
              uploadedUrl = uploadResponse.result.embed_url;
              console.log('Файл успешно загружен на DoodStream');
              break;
            } else if (uploadResponse.msg) {
              throw new Error(`Ошибка DoodStream: ${uploadResponse.msg}`);
            } else {
              throw new Error(`Неожиданный ответ сервера: ${JSON.stringify(uploadResponse)}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Ошибка при загрузке части 1 (попытка ${retryCount + 1}/${maxRetries}):`, errorMessage);
            retryCount++;

            if (retryCount < maxRetries) {
              const currentDelay = baseRetryDelay * Math.pow(2, retryCount);
              console.log(`Ожидание ${currentDelay / 1000} секунд перед следующей попыткой...`);
              await new Promise(resolve => setTimeout(resolve, currentDelay));
            }
          }
        }
      } else {
        // Если файл больше максимального размера части, используем многопоточную загрузку
        const chunkCount = Math.ceil(totalSize / MAX_CHUNK_SIZE);
        console.log(`Файл будет загружен в ${chunkCount} частях`);

        // Создаем массив задач для загрузки частей
        const uploadTasks: Promise<string | null>[] = [];
        let currentConcurrentUploads = 0;

        for (let i = 0; i < chunkCount; i++) {
          const start = i * MAX_CHUNK_SIZE;
          const end = Math.min(start + MAX_CHUNK_SIZE, totalSize);

          // Ждем, если достигнут лимит одновременных загрузок
          while (currentConcurrentUploads >= MAX_CONCURRENT_UPLOADS) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            currentConcurrentUploads = (await Promise.all(uploadTasks.map(async task => {
              const result = await Promise.race([task, Promise.resolve('pending')]);
              return result === 'pending';
            }))).filter(Boolean).length;
          }

          currentConcurrentUploads++;
          const uploadTask = uploadChunk(start, end, i, chunkCount).finally(() => {
            currentConcurrentUploads--;
          });
          uploadTasks.push(uploadTask);

          // Добавляем небольшую задержку между запусками загрузок
          if (i < chunkCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Ждем завершения всех загрузок
        const results = await Promise.all(uploadTasks);
        // Берем URL последней успешно загруженной части
        uploadedUrl = results[results.length - 1];

        for (let i = 0; i < chunkCount; i++) {
          retryCount = 0;
          let chunkUploaded = false;

          while (retryCount < maxRetries && !chunkUploaded) {
            try {
              const start = i * MAX_CHUNK_SIZE;
              const end = Math.min(start + MAX_CHUNK_SIZE, totalSize);
              const chunkSize = end - start;

              console.log(`Загрузка части ${i + 1}/${chunkCount} (${(chunkSize / (1024 * 1024)).toFixed(2)} МБ)`);

              const formData = new FormData();
              formData.append('api_key', this.doodStreamConfig.apiKey);
              
              // Создаем поток для чтения части файла
              const fileStream = fs.createReadStream(videoPath, { start, end: end - 1 });
              formData.append('file', fileStream);

              const response = await axios.post(`${this.doodStreamConfig.baseUrl}/upload`, formData, {
                headers: {
                  ...formData.getHeaders(),
                  'Content-Length': String(chunkSize)
                },
                maxBodyLength: MAX_CHUNK_SIZE + 1024 * 1024, // Добавляем буфер для метаданных
                timeout: 3600000, // 1 час таймаут
                validateStatus: (status) => status < 500 // Принимаем любой статус кроме 5xx
              });

              if (response.data.status === 200 && response.data.result) {
                if (i === chunkCount - 1) { // Сохраняем URL только последней части
                  uploadedUrl = response.data.result.embed_url;
                }
                console.log(`Часть ${i + 1}/${chunkCount} успешно загружена`);
                chunkUploaded = true;
              } else if (response.status === 413) {
                throw new Error('Превышен максимальный размер запроса');
              } else {
                throw new Error(`Неожиданный ответ сервера: ${JSON.stringify(response.data)}`);
              }

              // Добавляем адаптивную задержку между загрузками частей
              if (i < chunkCount - 1 && chunkUploaded) {
                const delay = Math.min(10000 + retryCount * 5000, 30000); // От 10 до 30 секунд
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            } catch (error) {
              console.error(`Ошибка при загрузке части ${i + 1} (попытка ${retryCount + 1}/${maxRetries}):`, error);
              retryCount++;
              
              if (retryCount < maxRetries) {
                const delay = this.retryDelay * Math.pow(2, retryCount); // Экспоненциальная задержка
                const jitter = Math.floor(Math.random() * 1000); // Добавляем случайную составляющую
                const finalDelay = delay + jitter;
                console.log(`Ожидание ${finalDelay/1000} секунд перед следующей попыткой...`);
                await new Promise(resolve => setTimeout(resolve, finalDelay));
              } else if (!chunkUploaded) {
                throw new Error(`Не удалось загрузить часть ${i + 1} после ${maxRetries} попыток`);
              }
            }
          }
        }
      }

      if (uploadedUrl) {
        // Удаляем локальный файл после успешной загрузки
        try {
          await fs.promises.unlink(videoPath);
          console.log(`Локальный файл ${videoPath} успешно удален`);
        } catch (deleteError) {
          console.warn(`Не удалось удалить локальный файл ${videoPath}:`, deleteError);
        }

        return {
          url: uploadedUrl,
          quality: 'HD', // Качество определяется сервисом DoodStream
          type: isSeries ? VideoType.EPISODE : VideoType.FULL_MOVIE,
          status: VideoStatus.READY,
          format: 'mp4'
        };
      }

      return null;
    } catch (error) {
      console.error('Ошибка при загрузке на DoodStream:', error);
      return null;
    }
  }

  private getDefaultHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
      'Connection': 'keep-alive'
    };
  }

  private detectQuality(title: string): VideoQuality {
    const lowerTitle = title.toLowerCase();
    // Расширенные шаблоны для определения качества
    const patterns = {
      '4K': ['2160p', '4k', 'uhd', 'ultra hd'],
      '1080p': ['1080p', 'fullhd', 'full hd', '1080'],
      'HD': ['720p', 'hd', 'hdrip'],
      '480p': ['480p', '480', 'dvdrip']
    };

    // Проверяем каждый шаблон
    for (const [quality, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => lowerTitle.includes(keyword))) {
        return quality as VideoQuality;
      }
    }

    // Дополнительная проверка для определения качества по размеру файла в названии
    const sizeMatch = lowerTitle.match(/\d+(?:\.\d+)?\s*(?:gb|гб)/i);
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[0]);
      if (size > 20) return '4K';
      if (size > 8) return '1080p';
      if (size > 4) return 'HD';
      if (size > 1) return '480p';
    }

    return 'unknown';
  }

  private isRussianContent(title: string): boolean {
    const lowerTitle = title.toLowerCase();
    const russianPatterns = [
      'rus',
      'рус',
      'дубляж',
      'дублированный',
      'озвучка',
      'перевод',
      'русский',
      'русская',
      'русское',
      'многоголосый',
      'профессиональный',
      'любительский',
      'субтитры',
      'локализация',
      'itunes',
      'лицензия',
      'официальный'
    ];

    // Проверяем наличие русских букв в названии
    const hasRussianLetters = /[а-яё]/i.test(title);

    // Проверяем наличие ключевых слов
    const hasRussianKeywords = russianPatterns.some(pattern => 
      lowerTitle.includes(pattern)
    );

    return hasRussianLetters || hasRussianKeywords;
  }

  private parseSize(sizeText: string): number {
    const match = sizeText.match(/(\d+(?:\.\d+)?)(\s*)(GB|MB|KB)/i);
    if (!match) return 0;

    const [, size, , unit] = match;
    const numSize = parseFloat(size);

    switch (unit.toLowerCase()) {
      case 'gb': return numSize * 1024 * 1024 * 1024;
      case 'mb': return numSize * 1024 * 1024;
      case 'kb': return numSize * 1024;
      default: return numSize;
    }
  }
}
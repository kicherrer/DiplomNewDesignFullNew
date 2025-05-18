import axios, { AxiosRequestConfig } from 'axios';
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

interface RutrackerConfig {
  username: string;
  password: string;
  baseUrl: string;
  loginUrl: string;
}

interface RutrackerSession {
  cookies: string[];
  lastLoginTime: number;
}

interface DoodStreamConfig {
  apiKey: string;
  baseUrl: string;
}

interface TorrentStatus {
  progress: number;
  state: string;
  name: string;
  save_path: string;
  content_path?: string;
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

interface DoodStreamUploadResult {
  status: number;
  msg: string;
  result?: {
    file_code: string;
    embed_url: string;
    quality?: string;
  };
}

interface VideoContentData {
  url: string;
  quality: string;
  type: VideoType;
  status: VideoStatus;
  size?: number;
  format: string;
}

export interface TorrentService {
  searchContent(query: string, originalTitle: string | null, isRussianDub: boolean): Promise<VideoContentData[]>;
  searchTorrents(query: string, isRussianDub?: boolean, originalTitle?: string | null): Promise<TorrentData[]>;
  selectBestTorrent(torrents: TorrentData[]): Promise<TorrentData | null>;
  downloadAndProcessTorrent(torrent: TorrentData): Promise<string | null>;
  uploadToDoodStream(videoPath: string): Promise<VideoContentData | null>;
}

export class VideoContentProvider implements TorrentService {
  private readonly doodStreamConfig: DoodStreamConfig;
  private readonly qbittorrentConfig: QBittorrentConfig;
  private readonly rutrackerConfig: RutrackerConfig;
  private readonly tempDir: string;
  private readonly outputDir: string;
  private session: RutrackerSession | null = null;
  private readonly baseUrl: string = 'https://rutracker.net';
  private readonly loginUrl: string = 'https://rutracker.net/forum/login.php';

  constructor(
    qbittorrentConfig: QBittorrentConfig,
    doodStreamConfig: DoodStreamConfig,
    tempDir: string = '/tmp/torrents',
    outputDir: string = '/tmp/videos'
  ) {
    this.doodStreamConfig = doodStreamConfig;
    this.qbittorrentConfig = qbittorrentConfig;
    this.rutrackerConfig = {
      username: 'Иванелло',
      password: '128Gsmt08',
      baseUrl: this.baseUrl,
      loginUrl: this.loginUrl
    };
    this.tempDir = tempDir;
    this.outputDir = outputDir;
  }

  private async ensureAuthenticated(): Promise<boolean> {
    try {
      if (this.session && Date.now() - this.session.lastLoginTime < 3600000) {
        return true;
      }

      // Получаем начальные куки и токен
      const initialResponse = await axios.get(this.loginUrl, {
        headers: this.getDefaultHeaders(),
        maxRedirects: 5,
        validateStatus: (status) => status === 200,
        responseType: 'arraybuffer',
        transformResponse: [(data) => {
          const win1251decoder = new TextDecoder('windows-1251');
          return win1251decoder.decode(data);
        }]
      });

      const $ = cheerio.load(initialResponse.data);
      const loginToken = $('input[name="login_token"]').val();
      const initialCookies = initialResponse.headers['set-cookie'];

      if (!initialCookies || !Array.isArray(initialCookies)) {
        console.error('Не получены начальные куки');
        return false;
      }

      // Формируем данные для авторизации
      const formData = new URLSearchParams();
      formData.append('login_username', this.rutrackerConfig.username);
      formData.append('login_password', this.rutrackerConfig.password);
      formData.append('login', 'Вход');
      formData.append('redirect', 'index.php');
      if (loginToken) {
        formData.append('login_token', loginToken);
      }

      // Выполняем запрос авторизации
      const loginResponse = await axios.post(this.loginUrl, formData.toString(), {
        headers: {
          ...this.getDefaultHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': initialCookies.join('; '),
          'Origin': this.baseUrl,
          'Referer': this.loginUrl
        },
        maxRedirects: 5,
        validateStatus: (status) => status === 200 || status === 302,
        responseType: 'arraybuffer',
        transformResponse: [(data) => {
          const win1251decoder = new TextDecoder('windows-1251');
          return win1251decoder.decode(data);
        }]
      });

      // Получаем и обрабатываем куки после авторизации
      const loginCookies = loginResponse.headers['set-cookie'];
      if (!loginCookies || !Array.isArray(loginCookies)) {
        console.error('Не получены куки после авторизации');
        return false;
      }

      // Объединяем все полученные куки
      const allCookies = [...new Set([...initialCookies, ...loginCookies])];
      
      // Проверяем наличие куки авторизации
      const authCookie = allCookies.find(cookie => 
        cookie.includes('bb_session') || 
        cookie.includes('bb_data')
      );

      if (!authCookie) {
        console.error('Не найдена кука авторизации');
        return false;
      }

      this.session = {
        cookies: allCookies,
        lastLoginTime: Date.now()
      };

      // Проверяем успешность авторизации
      const checkResponse = await axios.get(`${this.baseUrl}/forum/index.php`, {
        headers: {
          ...this.getDefaultHeaders(),
          'Cookie': allCookies.join('; ')
        },
        maxRedirects: 5,
        validateStatus: (status) => status === 200,
        responseType: 'arraybuffer',
        transformResponse: [(data) => {
          const win1251decoder = new TextDecoder('windows-1251');
          return win1251decoder.decode(data);
        }]
      });

      const checkHtml = cheerio.load(checkResponse.data);
      const isLoggedIn = checkHtml('#logged-in-username').length > 0 || 
                        checkResponse.data.includes('profile.php');

      if (isLoggedIn) {
        console.log('Успешная авторизация на RuTracker');
        return true;
      }

      console.error('Не удалось подтвердить авторизацию');
      return false;
    } catch (error) {
      console.error('Ошибка при авторизации:', error);
      return false;
    }
  }

  async searchContent(query: string, originalTitle: string | null = null, isRussianDub: boolean = true): Promise<VideoContentData[]> {
    try {
      const torrents = await this.searchTorrents(query, isRussianDub, originalTitle);
      if (torrents.length === 0) return [];

      const bestTorrent = await this.selectBestTorrent(torrents);
      if (!bestTorrent) return [];

      const videoPath = await this.downloadAndProcessTorrent(bestTorrent);
      if (!videoPath) return [];

      const uploadResult = await this.uploadToDoodStream(videoPath);
      return uploadResult ? [uploadResult] : [];

    } catch (error) {
      console.error('Ошибка при поиске контента:', error);
      return [];
    }
  }

  async searchTorrents(query: string, isRussianDub: boolean = true, originalTitle: string | null = null): Promise<TorrentData[]> {
    if (!query.trim()) throw new Error('Поисковый запрос не может быть пустым');

    try {
      // Проверяем авторизацию перед поиском
      const isAuthenticated = await this.ensureAuthenticated();
      if (!isAuthenticated) {
        throw new Error('Не удалось авторизоваться на RuTracker');
      }

      const searchQueries = this.generateSearchQueries(query, isRussianDub, originalTitle);
      const allTorrents: TorrentData[] = [];
      console.log(`Поиск торрентов по запросам: ${searchQueries.join(', ')}`);

      const maxSearchAttempts = 3;
      const baseDelay = 3000;

      for (const searchQuery of searchQueries) {
        let searchAttempt = 0;
        let lastError: Error | null = null;

        while (searchAttempt < maxSearchAttempts) {
          try {
            console.log(`Выполняем поиск: ${searchQuery} (попытка ${searchAttempt + 1}/${maxSearchAttempts})`);
            
            const jitter = Math.floor(Math.random() * 1000);
            const delay = baseDelay * Math.pow(2, searchAttempt) + jitter;
            if (searchAttempt > 0) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }

            const response = await axios.get(`${this.baseUrl}/forum/tracker.php`, {
              params: { nm: searchQuery },
              headers: {
                ...this.getDefaultHeaders(),
                'Cookie': this.session?.cookies.join('; ') || '',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': this.baseUrl,
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Charset': 'windows-1251,utf-8;q=0.7,*;q=0.7',
                'Connection': 'keep-alive'
              },
              timeout: 20000,
              maxRedirects: 5,
              validateStatus: (status) => status < 500,
              proxy: false,
              decompress: true,
              responseType: 'arraybuffer',
              transformResponse: [(data) => {
                const win1251decoder = new TextDecoder('windows-1251');
                return win1251decoder.decode(data);
              }]
            });

            if (!response.data) {
              console.error(`Пустой ответ от сервера для запроса: ${searchQuery}`);
              throw new Error('Пустой ответ от сервера');
            }

            if (typeof response.data !== 'string') {
              console.error(`Некорректный тип данных ответа для запроса: ${searchQuery}`);
              throw new Error('Некорректный тип данных ответа');
            }

            const htmlContent = response.data.trim();
            if (htmlContent.length === 0) {
              console.error(`Пустой HTML контент для запроса: ${searchQuery}`);
              throw new Error('Пустой HTML контент');
            }

            // Проверка на наличие признаков блокировки или капчи
            if (htmlContent.includes('blocked') || htmlContent.includes('captcha') || 
                htmlContent.includes('security check') || response.status === 403 || 
                response.status === 429) {
              throw new Error('Обнаружена блокировка или требуется капча');
            }

            let $;
            try {
              $ = cheerio.load(htmlContent);
              const torrentRows = $('.tCenter').length;
              console.log(`Найдено ${torrentRows} торрентов на странице для запроса: ${searchQuery}`);

              if (torrentRows === 0) {
                throw new Error('Не найдено торрентов на странице');
              }

              const torrents = await this.parseTorrents($);
              const validTorrents = torrents.filter((t: TorrentData) => this.isValidTorrent(t, isRussianDub));
              console.log(`Обработано ${torrents.length} торрентов, из них подходящих: ${validTorrents.length}`);
              
              if (validTorrents.length > 0) {
                console.log('Найдены подходящие торренты:', 
                  validTorrents.map(t => `${t.title} (${t.quality}, ${t.seeders} сидов)`))
                allTorrents.push(...validTorrents);
                
                if (allTorrents.length >= 15) {
                  console.log('Достигнут лимит торрентов (15), прекращаем поиск');
                  return this.sortTorrents(allTorrents);
                }

                // Успешно получили результаты, прерываем цикл попыток
                break;
              }
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              console.error(`Ошибка при обработке данных (попытка ${searchAttempt + 1}/${maxSearchAttempts}):`, 
                lastError.message);

              if (searchAttempt < maxSearchAttempts - 1) {
                searchAttempt++;
                continue;
              }
            }
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`Ошибка при выполнении запроса (попытка ${searchAttempt + 1}/${maxSearchAttempts}):`, 
              lastError.message);

            if (searchAttempt < maxSearchAttempts - 1) {
              searchAttempt++;
              continue;
            }
          }

          if (lastError) {
            console.error(`Все попытки поиска для запроса "${searchQuery}" завершились с ошибкой:`, 
              lastError.message);
          }
          break;
        }
      }

      const sortedTorrents = this.sortTorrents(allTorrents);
      console.log(`Итого найдено ${sortedTorrents.length} подходящих торрентов`);
      return sortedTorrents;
    } catch (error) {
      console.error('Ошибка при поиске торрентов:', error);
      return [];
    }
  }

  async selectBestTorrent(torrents: TorrentData[]): Promise<TorrentData | null> {
    if (torrents.length === 0) return null;

    return torrents.sort((a, b) => {
      const qualityScore = this.getQualityScore(a.quality) - this.getQualityScore(b.quality);
      if (qualityScore !== 0) return qualityScore;
      return b.seeders - a.seeders;
    })[0];
  }

  async downloadAndProcessTorrent(torrent: TorrentData): Promise<string | null> {
    if (!torrent.magnet && !torrent.torrentFile) {
      throw new Error('Отсутствует magnet-ссылка или торрент-файл');
    }

    try {
      const formData = new FormData();
      if (torrent.magnet) {
        formData.append('urls', torrent.magnet);
      } else if (torrent.torrentFile) {
        formData.append('torrents', torrent.torrentFile, 'file.torrent');
      }

      const response = await axios.post(
        `http://${this.qbittorrentConfig.host}:${this.qbittorrentConfig.port}/api/v2/torrents/add`,
        formData,
        {
          headers: formData.getHeaders(),
          auth: {
            username: this.qbittorrentConfig.username,
            password: this.qbittorrentConfig.password
          },
          maxContentLength: Infinity
        }
      );

      if (response.status !== 200) {
        throw new Error(`Ошибка добавления торрента: ${response.data}`);
      }

      const torrentProcessor = new TorrentProcessor(this.tempDir, this.outputDir);
      const videoPath = await torrentProcessor.monitorTorrentProgress(torrent.title, this.qbittorrentConfig);
      if (!videoPath) return null;

      return await torrentProcessor.processVideo(videoPath, 'mp4');
    } catch (error) {
      console.error('Ошибка при обработке торрента:', error);
      return null;
    }
  }

  async uploadToDoodStream(videoPath: string): Promise<VideoContentData | null> {
    try {
      if (!fs.existsSync(videoPath)) throw new Error(`Файл не найден: ${videoPath}`);

      const stats = fs.statSync(videoPath);
      if (stats.size === 0) throw new Error('Файл пуст');
      if (stats.size > 10 * 1024 * 1024 * 1024) throw new Error('Файл слишком большой');

      const formData = new FormData();
      formData.append('file', fs.createReadStream(videoPath));
      formData.append('api_key', this.doodStreamConfig.apiKey);

      const uploadResponse = await axios.post<DoodStreamUploadResult>(
        `${this.doodStreamConfig.baseUrl}/upload/url`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          maxContentLength: Infinity,
          timeout: 0
        }
      );

      if (!uploadResponse.data?.result?.embed_url) {
        throw new Error('URL для встраивания видео не получен');
      }

      return {
        url: uploadResponse.data.result.embed_url,
        quality: uploadResponse.data.result.quality || 'HD',
        type: VideoType.FULL_MOVIE,
        status: VideoStatus.READY,
        size: stats.size,
        format: 'mp4'
      };
    } catch (error) {
      console.error('Ошибка при загрузке на DoodStream:', error);
      return null;
    } finally {
      try {
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      } catch (error) {
        console.error('Ошибка при удалении временного файла:', error);
      }
    }
  }

  private getDefaultHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3'
    };
  }

  private async getTorrentDetails(topicLink: string): Promise<{ magnet?: string; seeders?: number }> {
    try {
      if (!this.session?.cookies) {
        throw new Error('Отсутствует сессия для получения деталей торрента');
      }

      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      const fullUrl = `${this.baseUrl}${topicLink}`;
      const response = await axios.get(fullUrl, {
        headers: {
          ...this.getDefaultHeaders(),
          'Cookie': this.session.cookies.join('; '),
          'Referer': this.baseUrl
        },
        timeout: 20000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        responseType: 'arraybuffer',
        transformResponse: [(data) => {
          const win1251decoder = new TextDecoder('windows-1251');
          return win1251decoder.decode(data);
        }]
      });

      if (!response.data || typeof response.data !== 'string') {
        throw new Error('Некорректный ответ при получении деталей торрента');
      }

      const $ = cheerio.load(response.data);

      // Поиск magnet-ссылки с учетом новой структуры
      const magnetLink = $('.magnet-link').attr('href') || 
                        $('a.med.magnet-link').attr('href') ||
                        $('a[href^="magnet:"]').attr('href');
      
      // Получение актуального количества сидов
      const seedersText = $('.seed, .seedmed').first().text().trim();
      const seeders = parseInt(seedersText) || 0;

      if (!magnetLink) {
        console.warn('Magnet-ссылка не найдена на странице:', fullUrl);
      }

      console.log('Получены детали торрента:', {
        hasMagnet: !!magnetLink,
        seeders,
        url: fullUrl
      });

      return {
        magnet: magnetLink,
        seeders: seeders > 0 ? seeders : undefined
      };
    } catch (error) {
      console.error('Ошибка при получении деталей торрента:', error);
      return {};
    }
  }



  private generateSearchQueries(query: string, isRussianDub: boolean, originalTitle: string | null): string[] {
    const queries = new Set<string>();
    const baseQueries = [query.trim()];
    if (originalTitle?.trim()) baseQueries.push(originalTitle.trim());

    baseQueries.forEach(baseQuery => {
      queries.add(baseQuery);
      if (isRussianDub) {
        ['дублированный', 'дубляж', 'русский перевод', 'лицензия', 'профессиональный перевод'].forEach(keyword => {
          queries.add(`${baseQuery} ${keyword}`);
        });
        // Добавляем год для уточнения поиска
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= currentYear - 2; year--) {
          queries.add(`${baseQuery} ${year}`);
          queries.add(`${baseQuery} ${year} лицензия`);
        }
      }
    });

    return Array.from(queries);
  }

  private parseTorrentTitle(rawTitle: string): { title: string; quality?: VideoQuality; language?: string } {
    // Извлекаем качество из названия
    const qualityMatch = rawTitle.match(/\b(4K|2160p|1080p|720p|480p|FullHD|HD)\b/i);
    const quality = qualityMatch ? this.normalizeQuality(qualityMatch[1]) : undefined;

    // Определяем язык
    const languageMatch = rawTitle.match(/\b(дублированный|дубляж|лицензия|профессиональный|русский)\b/i);
    const language = languageMatch ? 'russian' : undefined;

    // Очищаем название
    let title = rawTitle
      .replace(/\[[^\]]*\]/g, '') // Удаляем текст в квадратных скобках
      .replace(/\([^)]*\)/g, '') // Удаляем текст в круглых скобках
      .replace(/\{[^}]*\}/g, '') // Удаляем текст в фигурных скобках
      .replace(/\b(4K|2160p|1080p|720p|480p|FullHD|HD)\b/gi, '') // Удаляем маркеры качества
      .replace(/\b(дублированный|дубляж|лицензия|профессиональный|русский)\b/gi, '') // Удаляем маркеры языка
      .replace(/[\|\/\<\>«»]/g, ' ') // Удаляем специальные символы
      .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
      .trim();

    return { title, quality, language };
  }

  private normalizeQuality(quality: string): VideoQuality {
    quality = quality.toLowerCase();
    if (quality === '2160p' || quality === '4k') return '4K';
    if (quality === '1080p' || quality === 'fullhd') return '1080p';
    if (quality === '720p' || quality === 'hd') return '720p';
    if (quality === '480p') return '480p';
    return 'unknown';
  }

  private isValidQualityAndSize(quality: VideoQuality, size: number): boolean {
    const GB = 1024 * 1024 * 1024;
    const sizeGB = size / GB;

    switch (quality) {
      case '4K':
        return sizeGB >= 10 && sizeGB <= 80;
      case '1080p':
      case 'FullHD':
        return sizeGB >= 4 && sizeGB <= 25;
      case 'HD':
      case '720p':
        return sizeGB >= 2 && sizeGB <= 10;
      case '480p':
        return sizeGB >= 0.7 && sizeGB <= 5;
      default:
        return sizeGB >= 0.7 && sizeGB <= 25;
    }
  }

  private async parseTorrents($: cheerio.Root): Promise<TorrentData[]> {
    const torrents: TorrentData[] = [];
    // Используем более точный селектор для поиска торрентов
    const rows = $('table.forumline tr.hl-tr, table.forumline tr.tCenter');
    
    console.log(`Найдено ${rows.length} потенциальных торрентов для обработки`);

    for (const element of rows.toArray()) {
      try {
        const row = $(element);
        
        // Пропускаем заголовки и пустые строки
        if (row.hasClass('hl-tr') || !row.find('td').length) {
          continue;
        }

        // Используем более точные селекторы для поиска элементов
        const titleElement = row.find('td.t-title-col a.t-title, td.tt a.tLink, td.tt-text a.tLink');
        const sizeElement = row.find('td.tor-size, td.si-size, td.size');
        const seedersElement = row.find('td.seedmed, td.seed, td.si-seed');
        const topicLink = titleElement.attr('href');

        // Добавляем отладочную информацию
        console.log('Обработка торрента:', {
          title: titleElement.text().trim(),
          size: sizeElement.text().trim(),
          seeders: seedersElement.text().trim(),
          link: topicLink
        });
        
        // Проверка наличия всех необходимых элементов с подробным логированием
        if (!titleElement.length || !sizeElement.length || !seedersElement.length || !topicLink) {
          const debug = {
            rowId: row.attr('id'),
            rowClass: row.attr('class'),
            rowHtml: row.html()?.substring(0, 100),
            titleFound: titleElement.length > 0,
            titleText: titleElement.text().trim(),
            sizeFound: sizeElement.length > 0,
            sizeText: sizeElement.text().trim(),
            seedersFound: seedersElement.length > 0,
            seedersText: seedersElement.text().trim(),
            topicLinkFound: !!topicLink
          };
          console.log('Пропущен торрент: отсутствуют обязательные элементы', debug);
          continue;
        }

        // Получаем magnet-ссылку и актуальное количество сидов со страницы деталей торрента
        const torrentDetails = await this.getTorrentDetails(topicLink);
        if (!torrentDetails.magnet) {
          console.log(`Пропущен торрент: не удалось получить magnet-ссылку для ${topicLink}`);
          continue;
        }

        // Извлечение и очистка данных
        const rawTitle = titleElement.text().trim();
        const cleanedTitle = rawTitle
          .replace(/\s+/g, ' ')
          .replace(/\[[^\]]*\]/g, '') // Удаление текста в квадратных скобках
          .replace(/\([^)]*\)/g, '') // Удаление текста в круглых скобках
          .replace(/\{[^}]*\}/g, '') // Удаление текста в фигурных скобках
          .replace(/[\|\/\<\>«»]/g, ' ') // Удаление специальных символов
          .replace(/\s+/g, ' ')
          .trim();

        if (!cleanedTitle) {
          console.log('Пропущен торрент: не удалось извлечь название', { rawTitle });
          continue;
        }

        // Обработка размера
        const cleanedSizeStr = sizeElement.text()
          .replace(/[\s\u00A0]+/g, ' ')
          .replace(/[^0-9.,KMGTБkMmGgTtbБб\s]/gi, '')
          .trim();

        if (!cleanedSizeStr) {
          console.log('Пропущен торрент: пустое значение размера', {
            rawSize: sizeElement.text()
          });
          continue;
        }

        const parsedSize = this.parseSize(cleanedSizeStr);
        if (parsedSize === 0) {
          console.log('Пропущен торрент: некорректный размер', {
            title: cleanedTitle,
            originalSize: cleanedSizeStr,
            parsedSize
          });
          continue;
        }

        // Определение качества и языка
        const detectedQuality = this.detectQuality(cleanedTitle);
        const detectedLanguage = this.detectLanguage(cleanedTitle);

        // Создание объекта торрента
        const processedTorrent: TorrentData = {
          title: cleanedTitle,
          size: parsedSize,
          seeders: torrentDetails.seeders || parseInt(seedersElement.text().trim()) || 0,
          quality: detectedQuality,
          language: detectedLanguage,
          magnet: torrentDetails.magnet
        };

        // Проверка соответствия качества и размера
        if (this.isValidQualityAndSize(processedTorrent.quality, parsedSize)) {
          torrents.push(processedTorrent);
          console.log('Добавлен торрент:', {
            title: processedTorrent.title,
            quality: processedTorrent.quality,
            size: `${(parsedSize / 1024 / 1024 / 1024).toFixed(2)} GB`,
            seeders: processedTorrent.seeders,
            language: processedTorrent.language,
            hasMagnet: !!processedTorrent.magnet
          });
        } else {
          console.log('Пропущен торрент: несоответствие качества и размера', {
            quality: processedTorrent.quality,
            size: `${(parsedSize / 1024 / 1024 / 1024).toFixed(2)} GB`
          });
        }
      } catch (error) {
        console.error('Ошибка при обработке торрента:', error);
      }
    }

    console.log(`Успешно обработано ${torrents.length} торрентов из ${rows.length} найденных`);
    return torrents;
  }

  private isValidTorrent(torrent: TorrentData, isRussianDub: boolean): boolean {
    const minSize = 500 * 1024 * 1024;
    const maxSize = 20 * 1024 * 1024 * 1024;
    
    if (torrent.size < minSize || torrent.size > maxSize) return false;
    if (torrent.seeders < 2) return false;
    if (isRussianDub && !this.isRussianContent(torrent.title)) return false;
    
    return true;
  }

  private isRussianContent(title: string): boolean {
    const russianKeywords = [
      'дублированный',
      'дубляж',
      'дублирование',
      'профессиональный',
      'профессиональная',
      'многоголосый',
      'многоголосая',
      'многоголосное',
      'перевод',
      'озвучка',
      'озвучивание',
      'русский',
      'русская',
      'русское',
      'рус',
      'rus',
      'russian',
      'ru',
      'дтв',
      'нтв',
      'первый канал',
      'россия',
      'стс',
      'тнт',
      'рен-тв',
      'лицензия',
      'itunes',
      'web-dlrip',
      'bdrip',
      'hdtvrip',
      'dvdrip',
      'webrip'
    ];

    const lowerTitle = title.toLowerCase();
    return russianKeywords.some(keyword => lowerTitle.includes(keyword.toLowerCase()));
  }nContent(title: string): boolean {
    const russianKeywords = [
      'дублированный',
      'дубляж',
      'дублирование',
      'профессиональный перевод',
      'профессиональное многоголосое',
      'профессиональный многоголосый',
      'профессиональный (многоголосый)',
      'профессиональный (полное дублирование)',
      'русский перевод',
      'русская озвучка',
      'русский дубляж',
      'rus',
      'russian',
      'дублировано',
      'перевод',
      'озвучка',
      'локализация',
      'русский',
      'рус',
      'многоголосый',
      'многоголосое',
      'профессиональный'
    ];

    const lowerTitle = title.toLowerCase();
    return russianKeywords.some(keyword => lowerTitle.includes(keyword.toLowerCase())) ||
           /[а-яё]/i.test(title); // Проверка на наличие русских букв
  }

  private parseSize(sizeStr: string): number {
    try {
      const units = {
        KB: 1024,
        MB: 1024 ** 2,
        GB: 1024 ** 3,
        TB: 1024 ** 4
      };

      // Нормализация строки размера
      const normalizedStr = sizeStr
        .replace(/[\s\u00A0]+/g, ' ')
        .replace(',', '.')
        .toLowerCase();

      console.log('Обработка размера файла:', { исходный: sizeStr, нормализованный: normalizedStr });

      // Расширенный паттерн для поиска размера
      const match = normalizedStr.match(/(\d+(?:\.\d+)?)\s*(кб|kb|мб|mb|гб|gb|тб|tb)/i);
      
      if (!match) {
        console.error('Не удалось распознать формат размера:', { строка: normalizedStr });
        return 0;
      }

      const [, size, unit] = match;
      const normalizedUnit = unit.toLowerCase()
        .replace(/кб|kb/, 'KB')
        .replace(/мб|mb/, 'MB')
        .replace(/гб|gb/, 'GB')
        .replace(/тб|tb/, 'TB');

      const result = parseFloat(size) * units[normalizedUnit as keyof typeof units];
      console.log('Результат обработки размера:', { размер: size, единица: normalizedUnit, байт: result });
      
      return result;
    } catch (error) {
      console.error('Ошибка при парсинге размера:', { строка: sizeStr, ошибка: error });
      return 0;
    }
  }

  private detectQuality(title: string): VideoQuality {
    const qualityPatterns = [
      { quality: '4K', patterns: [/4K|2160p|UHD|Ultra HD|ULTRA HD/i] },
      { quality: '1080p', patterns: [/1080[pi]|FullHD|Full HD|FHD|FULLHD/i] },
      { quality: 'FullHD', patterns: [/1080[pi]|FullHD|Full HD|FHD|FULLHD/i] },
      { quality: 'HD', patterns: [/720[pi]|HD(?!\d)|НD|High Definition/i] },
      { quality: '720p', patterns: [/720[pi]|HD(?!\d)|НD|High Definition/i] },
      { quality: '480p', patterns: [/480[pi]|SD|Standard Definition/i] }
    ];

    // Проверяем наличие качества в названии
    for (const { quality, patterns } of qualityPatterns) {
      if (patterns.some(pattern => pattern.test(title))) {
        return quality as VideoQuality;
      }
    }

    // Если качество не найдено в названии, пытаемся определить по размеру файла
    if (title.toLowerCase().includes('blu-ray') || title.toLowerCase().includes('bdrip')) {
      return '1080p';
    }

    return 'unknown';
  }

  private detectLanguage(title: string): string {
    const russianPatterns = [
      // Основные маркеры
      /(?:^|[\[\s])(rus|russian|дубл[яе]ж|дублированн?ый|профессиональн?ый|лицензия)(?:[\]\s]|$)/i,
      
      // Студии дубляжа
      /(?:^|[\[\s])(невафильм|пифагор|мосфильм|амедиа|СВ-Дубль)(?:[\]\s]|$)/i,
      
      // Варианты озвучки
      /(?:^|[\[\s])(многоголос|двухголос|одноголос|закадров|озвучка|озвучивание|дублирование)(?:[\]\s]|$)/i,
      
      // Профессиональный перевод
      /(?:^|[\[\s])(проф\.?|профессиональн?ый\.?|пр\.?|professional)(?:[\]\s]|$)/i,
      
      // Русские аудиодорожки
      /(?:^|[\[\s])(rus\.?audio|russian\.?audio|русская\.?озвучка|русский\.?перевод)(?:[\]\s]|$)/i
    ];

    // Проверяем все паттерны
    if (russianPatterns.some(pattern => pattern.test(title))) {
      return 'russian';
    }

    // Проверяем наличие кириллицы в названии
    if (/[а-яё]/i.test(title)) {
      return 'russian';
    }

    return 'unknown';
  }

  private getQualityScore(quality: VideoQuality): number {
    const scores: Record<VideoQuality, number> = {
      '4K': 100,
      '1080p': 90,
      'FullHD': 85,
      'HD': 80,
      '720p': 70,
      '480p': 60,
      'unknown': 0
    };
    return scores[quality];
  }

  private sortTorrents(torrents: TorrentData[]): TorrentData[] {
    return torrents.sort((a, b) => {
      const qualityDiff = this.getQualityScore(b.quality) - this.getQualityScore(a.quality);
      if (qualityDiff !== 0) return qualityDiff;
      return b.seeders - a.seeders;
    });
  }
}
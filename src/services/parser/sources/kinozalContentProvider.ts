import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import FormData from 'form-data';
import { VideoType, VideoStatus } from '@prisma/client';
import { TorrentProcessor } from './torrentProcessor';

interface KinozalConfig {
  baseUrl: string;
  searchUrl: string;
  loginUrl: string;
  username: string;
  password: string;
}

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

export class KinozalContentProvider {
  private readonly kinozalConfig: KinozalConfig;
  private readonly qbittorrentConfig: QBittorrentConfig;
  private readonly doodStreamConfig: DoodStreamConfig;
  private readonly tempDir: string;
  private readonly outputDir: string;

  constructor(
    qbittorrentConfig: QBittorrentConfig,
    doodStreamConfig: DoodStreamConfig,
    tempDir: string = '/tmp/torrents',
    outputDir: string = '/tmp/videos'
  ) {
    this.kinozalConfig = {
      baseUrl: 'https://kinozal.tv',
      searchUrl: 'https://kinozal.tv/browse.php',
      loginUrl: 'https://kinozal.tv/takelogin.php',
      username: 'fefwe',
      password: '128Gsmt08'
    };
    this.qbittorrentConfig = qbittorrentConfig;
    this.doodStreamConfig = doodStreamConfig;
    this.tempDir = tempDir;
    this.outputDir = outputDir;
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

  private async searchTorrents(query: string, isRussianDub: boolean = true, originalTitle: string | null = null): Promise<TorrentData[]> {
    try {
      // Авторизация на сайте
      const loginFormData = new FormData();
      loginFormData.append('username', this.kinozalConfig.username);
      loginFormData.append('password', this.kinozalConfig.password);

      // Получаем начальные куки и токен с механизмом повторных попыток
      let initialResponse;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 2000; // 2 секунды между попытками

      while (retryCount < maxRetries) {
        try {
          // Увеличиваем таймаут и добавляем случайную задержку между попытками
          const randomDelay = Math.floor(Math.random() * 1000) + 1000; // 1-2 секунды
          await new Promise(resolve => setTimeout(resolve, randomDelay));

          // Эмулируем поведение реального браузера
          const browserHeaders = {
            ...this.getDefaultHeaders(),
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'X-Requested-With': 'XMLHttpRequest',
            'DNT': '1',
            'Upgrade-Insecure-Requests': '1'
          };

          // Добавляем случайный User-Agent из списка популярных
          const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
          ];
          browserHeaders['User-Agent'] = userAgents[Math.floor(Math.random() * userAgents.length)];

          initialResponse = await axios.get(this.kinozalConfig.baseUrl, {
            headers: browserHeaders,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400,
            timeout: 30000, // Увеличиваем таймаут до 30 секунд
            withCredentials: true,
            decompress: true // Включаем автоматическую распаковку сжатого контента
          });

          if (!initialResponse) {
            throw new Error('Не удалось получить ответ от сервера');
          }

          const initialCookies = initialResponse.headers['set-cookie'];
          if (initialCookies && Array.isArray(initialCookies) && initialCookies.length > 0) {
            // Проверяем наличие важных кук
            const hasCriticalCookies = initialCookies.some(cookie => 
              cookie.includes('PHPSESSID') || 
              cookie.includes('uid') || 
              cookie.includes('pass')
            );

            if (hasCriticalCookies) {
              console.log(`Успешно получены необходимые куки (попытка ${retryCount + 1})`);
              break;
            }
          }

          throw new Error('Необходимые куки отсутствуют в ответе');
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`Попытка ${retryCount + 1} не удалась: ${errorMessage}`);

          // Увеличиваем задержку с каждой попыткой
          const currentDelay = retryDelay * (retryCount + 1);
          console.log(`Ожидание ${currentDelay}мс перед следующей попыткой...`);
          
          // Проверяем, не является ли ошибка связанной с блокировкой
          if (errorMessage.includes('403') || 
              errorMessage.includes('forbidden') || 
              errorMessage.includes('blocked')) {
            console.log('Обнаружена возможная блокировка, увеличиваем время ожидания');
            await new Promise(resolve => setTimeout(resolve, currentDelay * 2));
          } else {
            await new Promise(resolve => setTimeout(resolve, currentDelay));
          }

          retryCount++;
          if (retryCount === maxRetries) {
            throw new Error(`Не удалось получить начальные куки после ${maxRetries} попыток: ${errorMessage}`);
          }
        }
      }

      const initialCookies = initialResponse?.headers['set-cookie'];
      if (!initialResponse) {
        throw new Error('Не удалось получить ответ от сервера');
      }
      if (!initialCookies || !Array.isArray(initialCookies)) {
        throw new Error('Не получены начальные куки');
      }

      // Выполняем запрос авторизации
      const loginResponse = await axios.post(this.kinozalConfig.loginUrl, loginFormData, {
        headers: {
          ...this.getDefaultHeaders(),
          ...loginFormData.getHeaders(),
          'Cookie': initialCookies.join('; '),
          'Origin': this.kinozalConfig.baseUrl,
          'Referer': `${this.kinozalConfig.baseUrl}/login.php`
        },
        maxRedirects: 5,
        validateStatus: (status) => status === 200 || status === 302
      });

      const loginCookies = loginResponse.headers['set-cookie'];
      if (!loginCookies || !Array.isArray(loginCookies)) {
        throw new Error('Не получены куки после авторизации');
      }

      // Объединяем все полученные куки
      const cookies = [...new Set([...initialCookies, ...loginCookies])];

      // Проверяем успешность авторизации
      const checkResponse = await axios.get(`${this.kinozalConfig.baseUrl}/my.php`, {
        headers: {
          ...this.getDefaultHeaders(),
          'Cookie': cookies.join('; ')
        },
        maxRedirects: 5,
        validateStatus: (status) => status === 200
      });

      if (checkResponse.data.includes('Вход на сайт') || checkResponse.data.includes('login.php')) {
        throw new Error('Ошибка авторизации: неверные учетные данные или доступ запрещен');
      }

      console.log(`Начинаем поиск торрентов для: ${query}${originalTitle ? `, оригинальное название: ${originalTitle}` : ''}`);
      
      // Подготовка поискового запроса
      const searchQuery = this.prepareSearchQuery(query, originalTitle);
      console.log(`Подготовленный поисковый запрос: ${searchQuery}`);

      // Выполнение запроса к Kinozal с разными категориями
      const categories = [1002, 8, 6, 15, 17]; // Фильмы, Зарубежные сериалы, Русские сериалы, Мультфильмы, Аниме
      let allTorrents: TorrentData[] = [];

      for (const category of categories) {
        try {
          const response = await axios.get(this.kinozalConfig.searchUrl, {
            params: {
              s: searchQuery,
              c: category,
              v: 0, // Все форматы
              d: 0, // Любая дата
              w: 0, // Любой размер
              t: 0, // Любой тип
              a: 0, // Активные раздачи
              sd: 0  // Сортировка по дате
            },
            headers: this.getDefaultHeaders()
          });

          const $ = cheerio.load(response.data);
          $('.bx1 tr:not(.bg)').each(async (_, element) => {
            const title = $(element).find('.nam a').text().trim();
            const sizeText = $(element).find('td:nth-child(4)').text().trim();
            const seedersText = $(element).find('td:nth-child(5)').text().trim();
            const quality = this.extractQuality(title);
            const language = this.extractLanguage(title);

            if (title && sizeText && seedersText) {
              const torrentLink = $(element).find('.nam a').attr('href');
              if (torrentLink) {
                // Получаем страницу раздачи для извлечения magnet-ссылки
                const torrentPageResponse = await axios.get(`${this.kinozalConfig.baseUrl}${torrentLink}`, {
                  headers: {
                    ...this.getDefaultHeaders(),
                    Cookie: cookies.join('; ')
                  }
                });

                const torrentPage$ = cheerio.load(torrentPageResponse.data);
                const downloadLink = torrentPage$('#download_url').attr('href');

                const torrentData = {
                  title,
                  size: this.parseSize(sizeText),
                  seeders: parseInt(seedersText) || 0,
                  quality,
                  language,
                  magnet: downloadLink ? `${this.kinozalConfig.baseUrl}${downloadLink}` : undefined
                };
                
                console.log(`Найден торрент: ${title}\n  - Качество: ${quality}\n  - Язык: ${language}\n  - Сидеры: ${torrentData.seeders}`);
                allTorrents.push(torrentData);
              }
            }
          });
        } catch (error) {
          console.error(`Ошибка при поиске в категории ${category}:`, error);
          continue;
        }
      }

      // Удаляем дубликаты по названию
      allTorrents = allTorrents.filter((torrent, index, self) =>
        index === self.findIndex((t) => t.title === torrent.title)
      );

      console.log(`Всего найдено результатов: ${allTorrents.length}`);
      const filteredTorrents = this.filterTorrents(allTorrents, isRussianDub);
      console.log(`Отфильтровано подходящих торрентов: ${filteredTorrents.length}`);

      return filteredTorrents;
    } catch (error) {
      console.error('Ошибка при поиске торрентов:', error);
      return [];
    }
  }

  private async selectBestTorrent(torrents: TorrentData[]): Promise<TorrentData | null> {
    return torrents.sort((a, b) => {
      const qualityScore = this.getQualityScore(b.quality) - this.getQualityScore(a.quality);
      if (qualityScore !== 0) return qualityScore;
      return b.seeders - a.seeders;
    })[0] || null;
  }

  private async downloadAndProcessTorrent(torrent: TorrentData): Promise<string | null> {
    try {
      if (!torrent.magnet) {
        throw new Error('Отсутствует ссылка на скачивание торрента');
      }

      // Скачиваем торрент-файл
      const torrentResponse = await axios.get(torrent.magnet, {
        headers: this.getDefaultHeaders(),
        responseType: 'arraybuffer'
      });

      if (!torrentResponse.data) {
        throw new Error('Не удалось получить торрент-файл');
      }

      const formData = new FormData();
      formData.append('torrents', new Blob([torrentResponse.data], { type: 'application/x-bittorrent' }), 'file.torrent');

      const response = await axios.post(
        `http://${this.qbittorrentConfig.host}:${this.qbittorrentConfig.port}/api/v2/torrents/add`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Type': 'multipart/form-data'
          },
          auth: {
            username: this.qbittorrentConfig.username,
            password: this.qbittorrentConfig.password
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
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

  private async uploadToDoodStream(videoPath: string): Promise<VideoContentData | null> {
    try {
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Файл не найден: ${videoPath}`);
      }

      const stats = fs.statSync(videoPath);
      if (stats.size === 0) throw new Error('Файл пуст');
      if (stats.size > 10 * 1024 * 1024 * 1024) throw new Error('Файл слишком большой');

      const formData = new FormData();
      formData.append('file', fs.createReadStream(videoPath));
      formData.append('api_key', this.doodStreamConfig.apiKey);

      const uploadResponse = await axios.post(
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
    // Генерируем случайные значения для заголовков
    const platforms = ['Windows', 'Macintosh', 'Linux'];
    const browsers = ['Chrome', 'Firefox', 'Safari'];
    const selectedPlatform = platforms[Math.floor(Math.random() * platforms.length)];
    const selectedBrowser = browsers[Math.floor(Math.random() * browsers.length)];
    const browserVersion = Math.floor(Math.random() * 20) + 100; // Версия от 100 до 120

    // Формируем случайный отпечаток браузера
    const browserSignature = selectedBrowser === 'Firefox' ?
      `Gecko/20100101 Firefox/${browserVersion}.0` :
      `AppleWebKit/537.36 (KHTML, like Gecko) ${selectedBrowser}/${browserVersion}.0.0.0 Safari/537.36`;

    const languages = [
      'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'en-US,en;q=0.9,ru;q=0.8',
      'ru,en-US;q=0.9,en;q=0.8'
    ];

    return {
      'User-Agent': `Mozilla/5.0 (${selectedPlatform}) ${browserSignature}`,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': languages[Math.floor(Math.random() * languages.length)],
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': `"${selectedBrowser}";v="${browserVersion}", "Not_A_Brand";v="8"`,
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': `"${selectedPlatform}"`,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'DNT': Math.random() > 0.5 ? '1' : '0' // Случайное значение Do Not Track
    };
  }

  private prepareSearchQuery(query: string, originalTitle: string | null): string {
    // Очищаем и нормализуем поисковые термины
    const cleanQuery = query.toLowerCase().trim();
    const searchTerms = [];

    // Функция для транслитерации русского текста
    const transliterate = (text: string): string => {
      const ru: { [key: string]: string } = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
        'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return text.split('').map(char => ru[char] || char).join('');
    };

    // Добавляем основной запрос и его транслитерацию
    searchTerms.push(cleanQuery);
    if (/[а-яё]/i.test(cleanQuery)) {
      const translitQuery = transliterate(cleanQuery);
      if (translitQuery !== cleanQuery) {
        searchTerms.push(translitQuery);
      }
    }

    // Добавляем оригинальное название и его вариации
    if (originalTitle) {
      const cleanOriginalTitle = originalTitle.toLowerCase().trim();
      if (cleanOriginalTitle !== cleanQuery) {
        searchTerms.push(cleanOriginalTitle);
        // Если оригинальное название на русском, добавляем его транслитерацию
        if (/[а-яё]/i.test(cleanOriginalTitle)) {
          searchTerms.push(transliterate(cleanOriginalTitle));
        }
      }
    }

    // Добавляем год, если он есть в названии
    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      searchTerms.push(yearMatch[0]);
    }

    // Удаляем дубликаты и пустые строки
    const uniqueTerms = [...new Set(searchTerms)].filter(term => term.length > 0);

    // Формируем окончательный поисковый запрос
    const finalQuery = uniqueTerms.join(' ');
    console.log(`Сформирован поисковый запрос: ${finalQuery}`);
    return finalQuery;
  }

  private extractQuality(title: string): VideoQuality {
    const qualityMap: { [key: string]: VideoQuality } = {
      '2160p': '4K',
      '4K': '4K',
      'UHD': '4K',
      '1080p': '1080p',
      'FullHD': 'FullHD',
      '720p': '720p',
      'HD': 'HD',
      '480p': '480p'
    };

    for (const [key, value] of Object.entries(qualityMap)) {
      if (title.includes(key)) {
        return value;
      }
    }

    return 'unknown';
  }

  private extractLanguage(title: string): string {
    if (title.toLowerCase().includes('дублирован') || 
        title.toLowerCase().includes('дубляж') || 
        title.toLowerCase().includes('dub')) {
      return 'russian';
    }
    return 'unknown';
  }

  private parseSize(sizeText: string): number {
    const match = sizeText.match(/(\d+(?:\.\d+)?)(\s*)(GB|MB|KB)/i);
    if (!match) return 0;

    const [, size, , unit] = match;
    const numSize = parseFloat(size);

    switch (unit.toUpperCase()) {
      case 'GB': return numSize * 1024 * 1024 * 1024;
      case 'MB': return numSize * 1024 * 1024;
      case 'KB': return numSize * 1024;
      default: return 0;
    }
  }

  private filterTorrents(torrents: TorrentData[], isRussianDub: boolean): TorrentData[] {
    return torrents.filter(torrent => {
      if (isRussianDub && torrent.language !== 'russian') {
        return false;
      }
      return torrent.seeders > 0;
    });
  }

  private getQualityScore(quality: VideoQuality): number {
    const scores: { [key in VideoQuality]: number } = {
      '4K': 6,
      '1080p': 5,
      'FullHD': 4,
      'HD': 3,
      '720p': 2,
      '480p': 1,
      'unknown': 0
    };
    return scores[quality] || 0;
  }
}
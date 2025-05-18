import { spawn } from 'child_process';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface TorrentStatus {
  progress: number;
  state: string;
  name: string;
  save_path: string;
  content_path: string | null;
}

export class TorrentProcessor {
  private readonly tempDir: string;
  private readonly outputDir: string;

  constructor(tempDir: string, outputDir: string) {
    this.tempDir = tempDir;
    this.outputDir = outputDir;
    this.ensureDirectoriesExist();
  }
  async processTorrent(torrentSource: Buffer | string, qbittorrentConfig: any): Promise<string | null> {
    try {
      let hash: string | null = null;

      // Проверяем, является ли источник magnet-ссылкой
      if (typeof torrentSource === 'string' && torrentSource.startsWith('magnet:')) {
        // Добавляем magnet-ссылку напрямую в qBittorrent
        const response = await axios.post(
          `http://${qbittorrentConfig.host}:${qbittorrentConfig.port}/api/v2/torrents/add`,
          `urls=${encodeURIComponent(torrentSource)}`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': `SID=${qbittorrentConfig.sid}`
            }
          }
        );

        if (response.status !== 200) {
          throw new Error('Ошибка при добавлении magnet-ссылки');
        }

        // Извлекаем хеш из magnet-ссылки
        const hashMatch = torrentSource.match(/xt=urn:btih:([^&]+)/);
        if (hashMatch) {
          hash = hashMatch[1].toLowerCase();
        } else {
          throw new Error('Не удалось извлечь хеш из magnet-ссылки');
        }
      } else {
        // Обрабатываем торрент-файл
        const torrentPath = path.join(this.tempDir, `temp_${Date.now()}.torrent`);
        if (Buffer.isBuffer(torrentSource)) {
          fs.writeFileSync(torrentPath, torrentSource);
        } else {
          const response = await axios.get(torrentSource, { responseType: 'arraybuffer' });
          fs.writeFileSync(torrentPath, response.data);
        }

        // Добавляем торрент в qBittorrent
        const formData = new FormData();
        const torrentBuffer = fs.readFileSync(torrentPath);
        formData.append('torrents', new Blob([torrentBuffer], { type: 'application/x-bittorrent' }), path.basename(torrentPath));
        
        const response = await axios.post(
          `http://${qbittorrentConfig.host}:${qbittorrentConfig.port}/api/v2/torrents/add`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Cookie': `SID=${qbittorrentConfig.sid}`
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );

        if (response.status !== 200) {
          throw new Error('Ошибка при добавлении торрента');
        }

        // Получаем хеш торрента
        hash = await this.getTorrentHash(torrentPath);
        fs.unlinkSync(torrentPath);
      }

      if (!hash) {
        throw new Error('Не удалось получить хеш торрента');
      }

      // Мониторим прогресс загрузки
      const videoPath = await this.monitorTorrentProgress(hash, qbittorrentConfig);
      if (!videoPath) {
        throw new Error('Не удалось получить путь к видеофайлу');
      }

      // Проверяем размер файла
      const stats = await fs.promises.stat(videoPath);
      const fileSizeGB = stats.size / (1024 * 1024 * 1024);
      
      if (fileSizeGB > 5) {
        throw new Error('Размер файла превышает 5 ГБ, что не поддерживается DoodStream');
      }

      // Удаляем торрент из клиента
      try {
        await axios.post(
          `http://${qbittorrentConfig.host}:${qbittorrentConfig.port}/api/v2/torrents/delete`,
          `hashes=${hash}&deleteFiles=false`,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          }
        );
        console.log('Торрент успешно удален из клиента');
      } catch (error) {
        console.warn('Не удалось удалить торрент из клиента:', error);
      }

      return videoPath;
    } catch (error) {
      console.error('Ошибка при обработке торрента:', error);
      return null;
    }
  }

  private async getTorrentHash(torrentPath: string): Promise<string | null> {
    try {
      const torrentData = fs.readFileSync(torrentPath);
      const hash = require('crypto')
        .createHash('sha1')
        .update(torrentData)
        .digest('hex');
      return hash;
    } catch (error) {
      console.error('Ошибка при получении хеша торрента:', error);
      return null;
    }
  }

  private ensureDirectoriesExist(): void {
    [this.tempDir, this.outputDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async monitorTorrentProgress(hash: string, qbittorrentConfig: any): Promise<string | null> {
    let attempts = 0;
    const maxAttempts = 720; // 6 часов при интервале в 30 секунд
    let lastProgress = 0;
    let stuckCounter = 0;
    const maxStuckAttempts = 10; // Максимальное количество попыток без прогресса

    while (attempts < maxAttempts) {
      try {
        const status = await this.getTorrentStatus(hash, qbittorrentConfig);
        const currentProgress = status.progress * 100;

        // Проверка состояния торрента
        if (status.state === 'error') {
          throw new Error('Ошибка загрузки торрента');
        }

        // Проверка на "застревание" загрузки
        if (Math.abs(currentProgress - lastProgress) < 0.1) {
          stuckCounter++;
          if (stuckCounter >= maxStuckAttempts) {
            console.log('Загрузка торрента застряла. Перезапуск клиента...');
            await this.restartTorrent(hash, qbittorrentConfig);
            stuckCounter = 0;
          }
        } else {
          stuckCounter = 0;
        }

        // Обновляем последний прогресс
        lastProgress = currentProgress;

        // Проверка завершения загрузки
        if (status.progress >= 0.9999 && ['completed', 'downloading', 'seeding', 'stalledUP'].includes(status.state)) {
          console.log('Торрент полностью загружен, переходим к обработке файла...');
          console.log('Торрент загружен успешно');
          
          // Ждем немного, чтобы убедиться, что файлы полностью записаны на диск
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Получаем путь к видеофайлу
          let videoPath = status.content_path;
          
          // Если путь не получен через API, пробуем найти файл вручную
          if (!videoPath) {
            console.log('Путь к файлу не получен через API, пробуем найти файл вручную...');
            videoPath = await this.findMainVideoFile(status.save_path, status.name);
            if (!videoPath) {
              throw new Error('Не удалось найти видеофайл после загрузки');
            }
          }

          // Проверяем состояние файла перед тем, как продолжить
          
          // Проверка доступности файла
          try {
            await fs.promises.access(videoPath, fs.constants.R_OK);
            const stats = await fs.promises.stat(videoPath);
            if (stats.size === 0) {
              throw new Error('Загруженный файл имеет нулевой размер');
            }
            console.log(`Видеофайл успешно проверен: ${videoPath} (${(stats.size / 1024 / 1024).toFixed(2)} МБ)`);
            console.log('Начинаем обработку видео...');
            // Удаляем торрент после успешной загрузки
            try {
              await axios.post(
                `http://${qbittorrentConfig.host}:${qbittorrentConfig.port}/api/v2/torrents/delete`,
                `hashes=${hash}&deleteFiles=false`,
                {
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
              );
              console.log('Торрент успешно удален из клиента');
            } catch (error) {
              console.warn('Не удалось удалить торрент из клиента:', error);
            }
            // Немедленно возвращаем путь к видео и прерываем цикл мониторинга
            return videoPath;
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Ошибка доступа к видеофайлу: ${errorMessage}`);
          }
        }

        console.log(`Прогресс загрузки: ${currentProgress.toFixed(2)}% (Состояние: ${status.state})`);
        await new Promise(resolve => setTimeout(resolve, 30000)); // Ждем 30 секунд
        attempts++;

      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Ошибка при мониторинге торрента:', error.message);
        } else if (axios.isAxiosError(error)) {
          console.error('Ошибка сети при мониторинге торрента:', error.message);
        } else {
          console.error('Неизвестная ошибка при мониторинге торрента:', String(error));
        }
        return null;
      }
    }

    throw new Error('Превышено время ожидания загрузки торрента');
  }

  private async getTorrentStatus(hash: string, config: any): Promise<TorrentStatus> {
    try {
      // Получаем основную информацию о торренте с повторными попытками
      const torrentResponse = await this.retryRequest(
        async () => await axios.get(
          `http://${config.host}:${config.port}/api/v2/torrents/info`,
          { 
            params: { hashes: hash },
            timeout: 10000,
            headers: {
              'Cookie': `SID=${config.sid}`
            }
          }
        )
      );

      if (!torrentResponse.data || torrentResponse.data.length === 0) {
        throw new Error('Торрент не найден');
      }

      const torrent = torrentResponse.data[0];

      // Пробуем получить информацию о файлах через разные API endpoints
      let filesData = null;
      let errorMessages = [];

      // Попытка 1: Стандартный API endpoint для файлов
      try {
        const filesResponse = await this.retryRequest(
          async () => await axios.get(
            `http://${config.host}:${config.port}/api/v2/torrents/files`,
            {
              params: { hash: hash },
              timeout: 10000,
              headers: {
                'Cookie': `SID=${config.sid}`
              }
            }
          )
        );
        if (filesResponse.data && filesResponse.data.length > 0) {
          filesData = filesResponse.data;
          console.log('Успешно получены данные через стандартный API endpoint');
        }
      } catch (error) {
        errorMessages.push(`Ошибка при использовании стандартного API: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Попытка 2: Альтернативный API endpoint для содержимого торрента
      if (!filesData) {
        try {
          const contentsResponse = await this.retryRequest(
            async () => await axios.get(
              `http://${config.host}:${config.port}/api/v2/torrents/properties`,
              {
                params: { hash: hash },
                timeout: 10000,
                headers: {
                  'Cookie': `SID=${config.sid}`
                }
              }
            )
          );
          if (contentsResponse.data) {
            console.log('Получена дополнительная информация о торренте через properties API');
          }
        } catch (error) {
          errorMessages.push(`Ошибка при использовании properties API: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Обработка полученных данных о файлах
      if (filesData) {
        const videoFiles = filesData.filter((file: any) => {
          const ext = path.extname(file.name).toLowerCase();
          return ['.mp4', '.mkv', '.avi', '.mov', '.wmv'].includes(ext);
        });

        if (videoFiles.length > 0) {
          const mainVideo = videoFiles.sort((a: any, b: any) => b.size - a.size)[0];
          const fullPath = path.join(torrent.save_path, mainVideo.name);
          
          if (fs.existsSync(fullPath)) {
            torrent.content_path = fullPath;
            console.log(`Найден видеофайл через API qBittorrent: ${fullPath}`);
            console.log(`Размер файла: ${(mainVideo.size / 1024 / 1024).toFixed(2)} МБ`);
          } else {
            console.warn(`Файл найден через API, но не существует на диске: ${fullPath}`);
            console.warn('Возможно, файл все еще загружается или был перемещен');
          }
        } else {
          console.warn('Видеофайлы не найдены в полученных данных');
        }
      } else {
        console.warn('Не удалось получить информацию о файлах через все доступные методы');
        console.warn('Причины ошибок:', errorMessages.join('\n'));
      }

      return {
        progress: torrent.progress,
        state: torrent.state,
        name: torrent.name,
        save_path: torrent.save_path,
        content_path: torrent.content_path || null
      };
    } catch (error) {
      console.error('Критическая ошибка при получении статуса торрента:', error);
      throw error;
    }
  }

  private async retryRequest<T>(request: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await request();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        console.warn(`Попытка ${attempt} не удалась, повторная попытка через ${delay}мс...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Превышено максимальное количество попыток');
  }

  private async restartTorrent(hash: string, config: any): Promise<void> {
    try {
      // Приостанавливаем торрент
      await axios.post(
        `http://${config.host}:${config.port}/api/v2/torrents/pause`,
        `hashes=${hash}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      // Ждем немного
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Возобновляем торрент
      await axios.post(
        `http://${config.host}:${config.port}/api/v2/torrents/resume`,
        `hashes=${hash}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      console.log('Торрент успешно перезапущен');
    } catch (error) {
      console.error('Ошибка при перезапуске торрента:', error);
      throw error;
    }
  }

  private async findMainVideoFile(savePath: string, torrentName: string): Promise<string | null> {
    try {
      // Проверяем существование директории загрузок
      if (!fs.existsSync(savePath)) {
        console.error(`Директория загрузок не существует: ${savePath}`);
        return null;
      }

      // Проверяем наличие файлов в директории
      if (!fs.existsSync(savePath)) {
        console.error(`Директория загрузок пуста: ${savePath}`);
        return null;
      }

      // Если content_path не доступен или файл не существует, используем запасной вариант
      console.log('Content path недоступен, использую запасной метод поиска файла...');
      
      const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv'];
      const normalizedTorrentName = this.normalizeFileName(torrentName);
      console.log(`Нормализованное имя торрента: ${normalizedTorrentName}`);

      interface VideoFile {
        path: string;
        size: number;
        matchScore: number;
      }

      let videoFiles: VideoFile[] = [];

      // Рекурсивно сканируем директорию загрузок
      const scanDirectory = (dir: string): void => {
        const entries = fs.readdirSync(dir);

        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            scanDirectory(fullPath);
          } else if (videoExtensions.includes(path.extname(entry).toLowerCase())) {
            const normalizedFileName = this.normalizeFileName(entry);
            const matchScore = this.calculateMatchScore(normalizedTorrentName, normalizedFileName);
            
            videoFiles.push({
              path: fullPath,
              size: stats.size,
              matchScore: matchScore
            });

            console.log(`Найден видеофайл: ${entry}`);
            console.log(`Размер: ${(stats.size / 1024 / 1024).toFixed(2)} МБ`);
            console.log(`Процент соответствия с торрентом: ${matchScore.toFixed(2)}%`);
          }
        }
      };

      scanDirectory(savePath);

      if (videoFiles.length > 0) {
        // Сортируем файлы по процентам соответствия и размеру
        videoFiles.sort((a, b) => {
          // Если разница в соответствии больше 20%, выбираем файл с лучшим соответствием
          if (Math.abs(a.matchScore - b.matchScore) > 20) {
            return b.matchScore - a.matchScore;
          }
          // Иначе выбираем больший файл
          return b.size - a.size;
        });

        const selectedFile = videoFiles[0];
        console.log(`Выбран видеофайл: ${path.basename(selectedFile.path)}`);
        console.log(`Размер: ${(selectedFile.size / 1024 / 1024).toFixed(2)} МБ`);
        console.log(`Процент соответствия: ${selectedFile.matchScore.toFixed(2)}%`);
        return selectedFile.path;
      }

      return null;
    } catch (error) {
      console.error('Ошибка при поиске видеофайла:', error);
      return null;
    }
  }

  private normalizeFileName(fileName: string): string {
    // Удаляем расширение файла
    let normalized = fileName.replace(/\.[^/.]+$/, '');
    
    // Заменяем точки и подчеркивания на пробелы
    normalized = normalized.replace(/[._]/g, ' ');
    
    // Удаляем специальные символы и приводим к нижнему регистру
    normalized = normalized.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').toLowerCase();
    
    // Удаляем лишние пробелы
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }

  private calculateMatchScore(torrentName: string, fileName: string): number {
    // Разбиваем имена на слова
    const torrentWords = new Set(torrentName.split(' '));
    const fileWords = new Set(fileName.split(' '));

    // Подсчитываем количество совпадающих слов
    let matchingWords = 0;
    for (const word of torrentWords) {
      if (fileWords.has(word)) {
        matchingWords++;
      }
    }

    // Вычисляем процент совпадения
    const totalWords = Math.max(torrentWords.size, fileWords.size);
    const matchPercentage = (matchingWords / totalWords) * 100;

    return matchPercentage;
  }

  async convertToMP4(inputPath: string): Promise<string> {
    const outputPath = path.join(this.outputDir, `${path.parse(inputPath).name}_converted.mp4`);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputPath
      ]);

      ffmpeg.stderr.on('data', (data) => {
        console.log(`ffmpeg: ${data}`);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`ffmpeg завершился с кодом ${code}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(err);
      });
    });
  }

  async convertToHLS(inputPath: string): Promise<string> {
    const outputDir = path.join(this.outputDir, path.parse(inputPath).name);
    const playlistPath = path.join(outputDir, 'playlist.m3u8');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-f', 'hls',
        '-hls_time', '10',
        '-hls_list_size', '0',
        '-hls_segment_filename', path.join(outputDir, 'segment%d.ts'),
        playlistPath
      ]);

      ffmpeg.stderr.on('data', (data) => {
        console.log(`ffmpeg: ${data}`);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(playlistPath);
        } else {
          reject(new Error(`ffmpeg завершился с кодом ${code}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(err);
      });
    });
  }

  async processExistingVideo(videoPath: string, format: 'mp4' | 'm3u8' = 'mp4'): Promise<string> {
    try {
      // Проверяем существование файла
      if (!fs.existsSync(videoPath)) {
        throw new Error('Видеофайл не найден');
      }

      // Проверяем доступность файла
      try {
        await fs.promises.access(videoPath, fs.constants.R_OK);
        const stats = await fs.promises.stat(videoPath);
        if (stats.size === 0) {
          throw new Error('Файл имеет нулевой размер');
        }
        console.log(`Видеофайл найден: ${videoPath} (${(stats.size / 1024 / 1024).toFixed(2)} МБ)`);
      } catch (error) {
        throw new Error(`Ошибка доступа к видеофайлу: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Обрабатываем видео
      return await this.processVideo(videoPath, format);
    } catch (error) {
      console.error('Ошибка при обработке существующего видео:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async processVideo(videoPath: string, format: 'mp4' | 'm3u8' = 'mp4'): Promise<string> {
    try {
      console.log(`Начало обработки видео: ${videoPath}`);
      const outputPath = format === 'mp4' 
        ? await this.convertToMP4(videoPath)
        : await this.convertToHLS(videoPath);

      console.log(`Видео успешно обработано: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('Ошибка при обработке видео:', error);
      throw error;
    }
  }
}
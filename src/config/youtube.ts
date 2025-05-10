// Конфигурация для YouTube API
export const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  console.error('YouTube API ключ не найден в переменных окружения. Пожалуйста, добавьте NEXT_PUBLIC_YOUTUBE_API_KEY в .env файл.');
}

// Конфигурация для YouTube API запросов
export const YOUTUBE_API_CONFIG = {
  baseURL: 'https://www.googleapis.com/youtube/v3',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  params: {
    part: 'snippet',
    maxResults: 1,
    type: 'video',
    videoEmbeddable: true
  }
};
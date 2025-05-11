import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';

interface WebSocketOptions {
  url: string;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  reconnectDelay?: number;
}

export const useWebSocket = ({
  url,
  onMessage,
  onError,
  reconnectDelay = 3000,
}: WebSocketOptions) => {
  const ws = useRef<WebSocket | null>(null);
  const dispatch = useDispatch();

  const connect = () => {
    if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('WebSocket: Токен авторизации отсутствует');
          // При отсутствии токена не пытаемся переподключаться
          return;
        }
        
        // Добавляем токен в URL для авторизации WebSocket
        const wsUrl = new URL(url);
        wsUrl.searchParams.append('token', token);
        
        ws.current = new WebSocket(wsUrl.toString());

        ws.current.onopen = () => {
          console.log('WebSocket соединение установлено');
          // Отправляем запрос на обновление данных при успешном подключении
          sendMessage({ type: 'REQUEST_UPDATES' });
        };

        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (onMessage) {
              onMessage(data);
            }
          } catch (error) {
            console.error('Ошибка при обработке сообщения WebSocket:', error);
          }
        };

        ws.current.onerror = (error) => {
          console.error('WebSocket ошибка:', error);
          if (onError) {
            onError(error);
          }
          // Попытка переподключения при ошибке
          setTimeout(connect, reconnectDelay);
        };

        ws.current.onclose = (event) => {
          console.log(`WebSocket соединение закрыто (код: ${event.code}), переподключение...`);
          setTimeout(connect, reconnectDelay);
        };
      } catch (error) {
        console.error('Ошибка при создании WebSocket соединения:', error);
        setTimeout(connect, reconnectDelay);
      }
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { sendMessage };
};
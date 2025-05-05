import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useDispatch } from 'react-redux';

interface WebSocketContextType {
  sendMessage: (message: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext должен использоваться внутри WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const dispatch = useDispatch();

  const { sendMessage } = useWebSocket({
    url: `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'}/ws`,
    onMessage: (data) => {
      // Обработка различных типов сообщений
      switch (data.type) {
        case 'HISTORY_UPDATE':
          // Обновление истории просмотров
          dispatch({ type: 'user/updateHistory', payload: data.payload });
          break;
        case 'MEDIA_UPDATE':
          // Обновление каталога медиа
          dispatch({ type: 'media/updateMedia', payload: data.payload });
          break;
        case 'PARSER_STATUS_UPDATE':
          // Обновление статуса парсера
          dispatch({ type: 'parser/updateStatus', payload: data.payload });
          break;
        default:
          console.log('Получено неизвестное сообщение:', data);
      }
    },
    onError: (error) => {
      console.error('WebSocket ошибка:', error);
    },
  });

  return (
    <WebSocketContext.Provider value={{ sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};
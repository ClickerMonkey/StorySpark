import { useEffect, useRef, useState } from 'react';

export interface WebSocketMessage {
  type: 'story_update' | 'image_generation_start' | 'image_generation_progress' | 'image_generation_complete' | 'image_generation_error';
  storyId: string;
  data?: any;
}

export interface ImageGenerationEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  storyId: string;
  pageNumber?: number;
  characterId?: string;
  message?: string;
  imageFileId?: string;
  error?: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [imageGenerationEvents, setImageGenerationEvents] = useState<ImageGenerationEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        if (message.type === 'image_generation_start') {
          setImageGenerationEvents(prev => [...prev, {
            type: 'start',
            storyId: message.storyId,
            pageNumber: message.data?.pageNumber,
            characterId: message.data?.characterId,
            message: 'Starting image generation...'
          }]);
        } else if (message.type === 'image_generation_progress') {
          setImageGenerationEvents(prev => [...prev, {
            type: 'progress',
            storyId: message.storyId,
            pageNumber: message.data?.pageNumber,
            characterId: message.data?.characterId,
            message: message.data?.progress
          }]);
        } else if (message.type === 'image_generation_complete') {
          setImageGenerationEvents(prev => [...prev, {
            type: 'complete',
            storyId: message.storyId,
            pageNumber: message.data?.pageNumber,
            characterId: message.data?.characterId,
            imageFileId: message.data?.imageFileId,
            message: 'Image generation complete!'
          }]);
        } else if (message.type === 'image_generation_error') {
          setImageGenerationEvents(prev => [...prev, {
            type: 'error',
            storyId: message.storyId,
            pageNumber: message.data?.pageNumber,
            characterId: message.data?.characterId,
            error: message.data?.error,
            message: `Error: ${message.data?.error}`
          }]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        connect();
      }, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  const subscribeToStory = (storyId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        storyId
      }));
    }
  };

  const clearEvents = () => {
    setImageGenerationEvents([]);
  };

  const getEventsForStory = (storyId: string) => {
    return imageGenerationEvents.filter(event => event.storyId === storyId);
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    imageGenerationEvents,
    subscribeToStory,
    clearEvents,
    getEventsForStory,
    connect,
    disconnect
  };
}
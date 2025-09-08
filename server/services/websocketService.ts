import WebSocket, { WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { Story } from '@shared/schema';

export interface WebSocketMessage {
  type: 'story_update' | 'image_generation_start' | 'image_generation_progress' | 'image_generation_complete' | 'image_generation_error';
  storyId: string;
  data?: any;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private connections = new Map<string, Set<WebSocket>>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('New WebSocket connection established');
      
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'subscribe' && data.storyId) {
            this.subscribeToStory(ws, data.storyId);
          }
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.unsubscribeFromAllStories(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.unsubscribeFromAllStories(ws);
      });

      // Send connection confirmation
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'connection_established' }));
      }
    });
  }

  private subscribeToStory(ws: WebSocket, storyId: string) {
    if (!this.connections.has(storyId)) {
      this.connections.set(storyId, new Set());
    }
    this.connections.get(storyId)!.add(ws);
    console.log(`WebSocket subscribed to story: ${storyId}`);
  }

  private unsubscribeFromAllStories(ws: WebSocket) {
    for (const [storyId, connections] of Array.from(this.connections)) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.connections.delete(storyId);
      }
    }
  }

  public broadcastToStory(storyId: string, message: WebSocketMessage) {
    const connections = this.connections.get(storyId);
    if (!connections) return;

    const messageStr = JSON.stringify(message);
    const toRemove: WebSocket[] = [];

    for (const ws of Array.from(connections)) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          toRemove.push(ws);
        }
      } else {
        toRemove.push(ws);
      }
    }

    // Clean up closed connections
    for (const ws of toRemove) {
      connections.delete(ws);
    }
  }

  public notifyStoryUpdate(storyId: string, story?: Partial<Story>) {
    this.broadcastToStory(storyId, {
      type: 'story_update',
      storyId,
      data: story
    });
  }

  public notifyImageGenerationStart(storyId: string, pageNumber?: number, characterId?: string) {
    this.broadcastToStory(storyId, {
      type: 'image_generation_start',
      storyId,
      data: { pageNumber, characterId }
    });
  }

  public notifyImageGenerationProgress(storyId: string, progress: string, pageNumber?: number, characterId?: string) {
    this.broadcastToStory(storyId, {
      type: 'image_generation_progress',
      storyId,
      data: { progress, pageNumber, characterId }
    });
  }

  public notifyImageGenerationComplete(storyId: string, imageFileId: string, pageNumber?: number, characterId?: string) {
    this.broadcastToStory(storyId, {
      type: 'image_generation_complete',
      storyId,
      data: { imageFileId, pageNumber, characterId }
    });
  }

  public notifyImageGenerationError(storyId: string, error: string, pageNumber?: number, characterId?: string) {
    this.broadcastToStory(storyId, {
      type: 'image_generation_error',
      storyId,
      data: { error, pageNumber, characterId }
    });
  }
}

// Global instance
let webSocketService: WebSocketService | null = null;

export function initializeWebSocketService(server: Server): WebSocketService {
  webSocketService = new WebSocketService(server);
  return webSocketService;
}

export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}
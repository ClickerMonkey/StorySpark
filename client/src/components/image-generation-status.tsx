import { useEffect, useState } from 'react';
import { useWebSocket, type ImageGenerationEvent } from '@/hooks/useWebSocket';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, Image } from 'lucide-react';

interface ImageGenerationStatusProps {
  storyId: string;
  onImageComplete?: (imageFileId: string, pageNumber?: number) => void;
}

export function ImageGenerationStatus({ storyId, onImageComplete }: ImageGenerationStatusProps) {
  const { isConnected, subscribeToStory, getEventsForStory, clearEvents } = useWebSocket();
  const [events, setEvents] = useState<ImageGenerationEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isConnected && storyId) {
      subscribeToStory(storyId);
    }
  }, [isConnected, storyId, subscribeToStory]);

  useEffect(() => {
    const storyEvents = getEventsForStory(storyId);
    setEvents(storyEvents);
    
    // Show status when generation starts or is in progress
    const hasActiveGeneration = storyEvents.some(event => 
      event.type === 'start' || event.type === 'progress'
    );
    const hasRecentActivity = storyEvents.length > 0 && 
      Date.now() - (storyEvents[storyEvents.length - 1] as any).timestamp < 30000; // 30 seconds
    
    setIsVisible(hasActiveGeneration || hasRecentActivity);

    // Call callback when image generation completes
    const completeEvents = storyEvents.filter(event => event.type === 'complete');
    completeEvents.forEach(event => {
      if (event.imageFileId) {
        onImageComplete?.(event.imageFileId, event.pageNumber);
      }
    });
  }, [getEventsForStory, storyId, onImageComplete]);

  const currentEvent = events[events.length - 1];

  if (!isVisible || !currentEvent) {
    return null;
  }

  const getStatusIcon = () => {
    switch (currentEvent.type) {
      case 'start':
      case 'progress':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Image className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    const pageText = currentEvent.pageNumber ? ` (Page ${currentEvent.pageNumber})` : '';
    return currentEvent.message + pageText;
  };

  const getStatusVariant = () => {
    switch (currentEvent.type) {
      case 'start':
      case 'progress':
        return 'secondary' as const;
      case 'complete':
        return 'default' as const;
      case 'error':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  const isGenerating = currentEvent.type === 'start' || currentEvent.type === 'progress';

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{getStatusText()}</span>
              <Badge variant={getStatusVariant()}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            {isGenerating && (
              <Progress value={undefined} className="mt-2 h-2" />
            )}
          </div>
        </div>
        
        {events.length > 1 && (
          <div className="mt-3 space-y-1">
            <button
              onClick={() => setEvents([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear status ({events.length} events)
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";

interface ImageViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
}

export function ImageViewerDialog({ isOpen, onClose, imageUrl, title }: ImageViewerDialogProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.5, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.5), 5));
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95">
        <DialogHeader className="absolute top-4 left-4 z-10">
          <DialogTitle className="text-white text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>
        
        {/* Controls */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            className="bg-black/50 border-white/20 text-white hover:bg-white/10"
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            className="bg-black/50 border-white/20 text-white hover:bg-white/10"
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="bg-black/50 border-white/20 text-white hover:bg-white/10"
            data-testid="button-reset-view"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="bg-black/50 border-white/20 text-white hover:bg-white/10"
            data-testid="button-close-dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Image Container */}
        <div 
          className="flex items-center justify-center w-full h-full overflow-hidden cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt={title}
            className="max-w-none max-h-none select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            draggable={false}
          />
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-lg">
            Scroll to zoom • Drag to pan • Click buttons or press ESC to close
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
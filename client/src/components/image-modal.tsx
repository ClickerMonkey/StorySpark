import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { useState } from "react";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, alt }: ImageModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const resetTransforms = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full h-[90vh] p-0 bg-black/90 border-none">
        {/* Header Controls */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRotate}
            data-testid="button-rotate"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={resetTransforms}
            data-testid="button-reset"
          >
            Reset
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            data-testid="button-close-modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Image Container */}
        <div 
          className="flex items-center justify-center w-full h-full overflow-auto cursor-move"
          onClick={(e) => {
            // Close modal when clicking the background
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-none transition-transform duration-200 select-none"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              maxHeight: zoom === 1 ? '80vh' : 'none',
              maxWidth: zoom === 1 ? '80vw' : 'none'
            }}
            draggable={false}
            data-testid="modal-image"
          />
        </div>

        {/* Bottom Info */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
          {alt} • Zoom: {Math.round(zoom * 100)}%
        </div>
      </DialogContent>
    </Dialog>
  );
}
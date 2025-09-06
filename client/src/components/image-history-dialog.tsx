import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type ImageVersion, type Story } from "@shared/schema";
import { Clock, RotateCcw, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ImageHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  story: Story;
  pageNumber: number;
  imageHistory?: ImageVersion[];
}

export function ImageHistoryDialog({ 
  open, 
  onOpenChange, 
  story, 
  pageNumber, 
  imageHistory = [] 
}: ImageHistoryDialogProps) {
  const [selectedVersion, setSelectedVersion] = useState<ImageVersion | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const restoreVersionMutation = useMutation({
    mutationFn: async (version: ImageVersion) => {
      const response = await apiRequest("POST", `/api/stories/${story.id}/pages/${pageNumber}/restore-image`, {
        imageUrl: version.url,
        prompt: version.prompt || ""
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stories", story.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
      toast({
        title: "Image Restored!",
        description: "Previous version has been set as the current image",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Restore Failed",
        description: error instanceof Error ? error.message : "Failed to restore image version",
        variant: "destructive",
      });
    },
  });

  const handleRestoreVersion = (version: ImageVersion) => {
    restoreVersionMutation.mutate(version);
  };

  const sortedHistory = [...imageHistory].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Image History - Page {pageNumber}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[70vh] pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedHistory.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No previous versions available</p>
              </div>
            ) : (
              sortedHistory.map((version, index) => (
                <Card 
                  key={index} 
                  className={`cursor-pointer transition-all ${
                    version.isActive 
                      ? 'ring-2 ring-blue-500' 
                      : selectedVersion === version 
                        ? 'ring-2 ring-indigo-400' 
                        : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedVersion(version)}
                  data-testid={`image-version-${index}`}
                >
                  <CardContent className="p-4">
                    <div className="aspect-video relative mb-3 rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={version.url}
                        alt={`Version ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {version.isActive && (
                        <Badge className="absolute top-2 right-2 bg-blue-600">
                          Current
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(version.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                      
                      {version.prompt && (
                        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          <strong>Prompt:</strong> {version.prompt}
                        </p>
                      )}
                      
                      {!version.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          disabled={restoreVersionMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreVersion(version);
                          }}
                          data-testid={`button-restore-${index}`}
                        >
                          {restoreVersionMutation.isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Restoring...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restore This Version
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
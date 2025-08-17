import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  History, 
  Clock, 
  GitBranch, 
  ArrowRight, 
  Edit3, 
  Check,
  AlertTriangle,
  Plus
} from "lucide-react";
import { type StoryRevision } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface RevisionPanelProps {
  storyId: string;
  currentRevision: number;
  onRevisionLoaded?: () => void;
}

export function RevisionPanel({ storyId, currentRevision, onRevisionLoaded }: RevisionPanelProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRevisionDescription, setNewRevisionDescription] = useState("");
  const queryClient = useQueryClient();

  const { data: revisionsData, isLoading } = useQuery({
    queryKey: ['/api/stories', storyId, 'revisions'],
    enabled: !!storyId,
  });

  const loadRevisionMutation = useMutation({
    mutationFn: async (revisionNumber: number) => {
      const response = await apiRequest('POST', `/api/stories/${storyId}/revisions/${revisionNumber}/load`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stories', storyId] });
      onRevisionLoaded?.();
    },
  });

  const createRevisionMutation = useMutation({
    mutationFn: async ({ step, description }: { step: string; description?: string }) => {
      const response = await apiRequest('POST', `/api/stories/${storyId}/revisions`, { step, description });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stories', storyId, 'revisions'] });
      setIsCreateDialogOpen(false);
      setNewRevisionDescription("");
    },
  });

  const revisions: StoryRevision[] = (revisionsData as any)?.revisions || [];

  const getStepBadgeColor = (step: string) => {
    switch (step) {
      case "details": return "bg-blue-100 text-blue-800 border-blue-200";
      case "setting": return "bg-green-100 text-green-800 border-green-200";
      case "characters": return "bg-purple-100 text-purple-800 border-purple-200";
      case "review": return "bg-orange-100 text-orange-800 border-orange-200";
      case "images": return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "complete": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStepLabel = (step: string) => {
    switch (step) {
      case "details": return "Story Details";
      case "setting": return "Setting Expansion";
      case "characters": return "Character Definition";
      case "review": return "Story Review";
      case "images": return "Image Generation";
      case "complete": return "Complete";
      default: return step;
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Revisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Loading revisions...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Revisions ({revisions.length})
          </CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-create-revision">
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Revision</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={newRevisionDescription}
                    onChange={(e) => setNewRevisionDescription(e.target.value)}
                    placeholder="Describe what you're changing..."
                    className="mt-1"
                    data-testid="textarea-revision-description"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-revision"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createRevisionMutation.mutate({ 
                      step: "review", 
                      description: newRevisionDescription || undefined 
                    })}
                    disabled={createRevisionMutation.isPending}
                    data-testid="button-confirm-create-revision"
                  >
                    {createRevisionMutation.isPending ? "Creating..." : "Create Revision"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-6 space-y-4">
            {revisions.length === 0 ? (
              <div className="text-center py-8">
                <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500">No revisions yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Revisions are created automatically when you edit earlier steps
                </p>
              </div>
            ) : (
              revisions.map((revision, index) => (
                <div key={revision.id} className="relative">
                  {/* Connection line */}
                  {index < revisions.length - 1 && (
                    <div className="absolute left-6 top-12 bottom-0 w-px bg-gray-200" />
                  )}
                  
                  <div className={`relative border rounded-lg p-4 ${
                    revision.revisionNumber === currentRevision 
                      ? "border-indigo-200 bg-indigo-50" 
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}>
                    {/* Current revision indicator */}
                    {revision.revisionNumber === currentRevision && (
                      <div className="absolute -top-2 -right-2">
                        <Badge className="bg-indigo-600 text-white">
                          <Check className="h-3 w-3 mr-1" />
                          Current
                        </Badge>
                      </div>
                    )}

                    {/* Revision header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700">
                          {revision.revisionNumber}
                        </div>
                        <Badge 
                          className={getStepBadgeColor(revision.stepCompleted)}
                          data-testid={`badge-step-${revision.stepCompleted}`}
                        >
                          {getStepLabel(revision.stepCompleted)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(revision.createdAt), { addSuffix: true })}
                      </div>
                    </div>

                    {/* Revision description */}
                    {revision.description && (
                      <p className="text-sm text-gray-700 mb-3" data-testid={`text-revision-description-${revision.revisionNumber}`}>
                        {revision.description}
                      </p>
                    )}

                    {/* Parent revision info */}
                    {revision.parentRevision && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        <GitBranch className="h-3 w-3" />
                        <span>Branched from revision {revision.parentRevision}</span>
                      </div>
                    )}

                    {/* Story info preview */}
                    <div className="space-y-1 text-xs text-gray-600 mb-3">
                      <div><strong>Title:</strong> {revision.title}</div>
                      <div><strong>Status:</strong> {revision.status}</div>
                      {revision.pages.length > 0 && (
                        <div><strong>Pages:</strong> {revision.pages.length}</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {revision.revisionNumber !== currentRevision && (
                        <Button
                          size="sm"
                          onClick={() => loadRevisionMutation.mutate(revision.revisionNumber)}
                          disabled={loadRevisionMutation.isPending}
                          className="flex-1"
                          data-testid={`button-load-revision-${revision.revisionNumber}`}
                        >
                          {loadRevisionMutation.isPending ? (
                            "Loading..."
                          ) : (
                            <>
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Load This Version
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
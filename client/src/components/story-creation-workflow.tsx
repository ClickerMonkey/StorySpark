import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStorySchema, insertStorySchema, type CreateStory, type Story, type StoryPage, type Character } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ImageViewerDialog } from "@/components/image-viewer-dialog";
import { getCoreImageUrl, getPageImageUrl, getCharacterImageUrl } from "@/utils/imageUrl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { RevisionPanel } from "@/components/revision-panel";
import { Loader2, BookOpen, Users, ScrollText, Palette, Eye, Edit, Check, Plus, History, RefreshCw, Sparkles, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";

type WorkflowStep = "details" | "setting" | "characters" | "review" | "images" | "complete";

interface StoryCreationWorkflowProps {
  onComplete?: (story: Story) => void;
  existingStory?: Story;
}

interface PageImageCardProps {
  page: StoryPage;
  storyPage?: StoryPage;
  isGenerating: boolean;
  hasImage?: string;
  storyId: string;
  onImageRegenerated: (story: Story) => void;
}

function PageImageCard({ page, storyPage, isGenerating, hasImage, storyId, onImageRegenerated }: PageImageCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCurrentImageAsReference, setUseCurrentImageAsReference] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const { toast } = useToast();

  const regenerateImageMutation = useMutation({
    mutationFn: async ({ prompt, useReference }: { prompt: string; useReference: boolean }) => {
      const requestBody: any = {
        customPrompt: prompt,
      };
      
      // Add current image reference if checkbox is checked and image exists
      if (useReference && hasImage) {
        requestBody.currentImageUrl = hasImage;
      }
      
      const response = await apiRequest("POST", `/api/stories/${storyId}/pages/${page.pageNumber}/regenerate-image`, requestBody);
      return response.json();
    },
    onSuccess: (data) => {
      onImageRegenerated(data.story);
      setIsRegenerating(false);
      setShowCustomPrompt(false);
      setCustomPrompt("");
      setUseCurrentImageAsReference(false);
      toast({
        title: "Image Regenerated!",
        description: "Your page image has been updated with the new prompt.",
      });
    },
    onError: (error) => {
      setIsRegenerating(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to regenerate image",
        variant: "destructive",
      });
    },
  });

  const handleRegenerate = () => {
    setIsRegenerating(true);
    // Use custom prompt if provided, otherwise send empty string for default behavior
    regenerateImageMutation.mutate({ 
      prompt: customPrompt.trim(), 
      useReference: useCurrentImageAsReference 
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        {/* Image Section */}
        <div className="flex-shrink-0 mx-auto sm:mx-0">
          <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
            {isGenerating || isRegenerating ? (
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">
                  {isRegenerating ? "Regenerating..." : "Generating..."}
                </p>
              </div>
            ) : hasImage ? (
              <img 
                src={hasImage}
                alt={`Page ${page.pageNumber}`}
                className="w-32 h-32 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setShowImageDialog(true)}
              />
            ) : (
              <div className="text-center text-gray-400">
                <Palette size={32} className="mx-auto mb-2" />
                <p className="text-xs">No image yet</p>
              </div>
            )}
          </div>
          
          {/* Regenerate Button - Always available unless actively generating */}
          {!isGenerating && !isRegenerating && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustomPrompt(!showCustomPrompt)}
              className="w-full mt-3 flex items-center gap-2"
              data-testid={`button-regenerate-page-${page.pageNumber}`}
            >
              <RefreshCw className="h-4 w-4" />
              {hasImage ? "Regenerate" : "Generate"}
            </Button>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-gray-900">Page {page.pageNumber}</h4>
            <div className="flex items-center gap-2">
              {hasImage && (
                <span className="flex items-center text-sm text-emerald-600">
                  <Check className="h-4 w-4 mr-1" />
                  Complete
                </span>
              )}
              {isGenerating && (
                <span className="flex items-center text-sm text-indigo-600">
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Generating
                </span>
              )}
              {!hasImage && !isGenerating && (
                <span className="text-sm text-gray-500">Ready to generate</span>
              )}
            </div>
          </div>

          {/* Page Text */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <ScrollText className="h-4 w-4 mr-1" />
              Page Text
            </h5>
            <p className="text-sm text-gray-800 leading-relaxed">
              {storyPage?.text || page.text}
            </p>
          </div>

          {/* Custom Prompt Input */}
          {showCustomPrompt && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h5 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                <Sparkles className="h-4 w-4 mr-1" />
                {hasImage ? "Custom Regeneration Prompt" : "Custom Generation Prompt"}
              </h5>
              <div className="space-y-3">
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={hasImage 
                    ? "Optional: Describe how you want this image to look different. Leave empty to use default AI generation. For example: 'Make the forest more magical with glowing fireflies and sparkles in the air'"
                    : "Optional: Describe specific details you want in this image. Leave empty to use default AI generation. For example: 'A magical forest scene with tall trees, soft sunlight filtering through leaves, and a winding path'"
                  }
                  className="resize-none"
                  rows={3}
                  data-testid={`input-custom-prompt-${page.pageNumber}`}
                />
                
                {/* Use Current Image as Reference Checkbox - Only show for regeneration */}
                {hasImage && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`use-reference-${page.pageNumber}`}
                      checked={useCurrentImageAsReference}
                      onCheckedChange={(checked) => setUseCurrentImageAsReference(!!checked)}
                      data-testid={`checkbox-use-reference-${page.pageNumber}`}
                    />
                    <label
                      htmlFor={`use-reference-${page.pageNumber}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Use current image as reference
                    </label>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={regenerateImageMutation.isPending}
                    data-testid={`button-apply-prompt-${page.pageNumber}`}
                  >
                    {regenerateImageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    {hasImage ? "Apply Changes" : "Generate Image"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCustomPrompt(false);
                      setCustomPrompt("");
                      setUseCurrentImageAsReference(false);
                    }}
                    data-testid={`button-cancel-prompt-${page.pageNumber}`}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Full-screen Image Dialog */}
      <ImageViewerDialog
        isOpen={showImageDialog}
        onClose={() => setShowImageDialog(false)}
        imageUrl={hasImage || ""}
        title={`Page ${page.pageNumber} Image`}
      />
    </div>
  );
}


// Core image display component
interface CoreImageDisplayProps {
  imageUrl: string;
  storyId?: string;
  onImageRegenerated?: (updatedStory: Story) => void;
}

function CoreImageDisplay({ imageUrl, storyId, onImageRegenerated }: CoreImageDisplayProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCurrentImageAsReference, setUseCurrentImageAsReference] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const regenerateMutation = useMutation({
    mutationFn: async (data: { customPrompt: string; useCurrentImageAsReference: boolean }) => {
      const response = await apiRequest("POST", `/api/stories/${storyId}/regenerate-core-image`, data);
      return response.json();
    },
    onSuccess: (data) => {
      setIsRegenerating(false);
      setShowRegenerateDialog(false);
      setCustomPrompt("");
      setUseCurrentImageAsReference(false);
      toast({
        title: "Success",
        description: "Core image regenerated successfully!",
      });
      // Update the story data
      if (onImageRegenerated && data.story) {
        onImageRegenerated(data.story);
      }
      // Invalidate queries to refresh story data
      queryClient.invalidateQueries({ queryKey: ['/api/stories', storyId] });
    },
    onError: (error: Error) => {
      setIsRegenerating(false);
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate core image",
        variant: "destructive",
      });
    },
  });

  const handleRegenerate = () => {
    if (!storyId) {
      toast({
        title: "Error",
        description: "Story ID is required to regenerate image",
        variant: "destructive",
      });
      return;
    }

    if (!customPrompt.trim()) {
      toast({
        title: "Error", 
        description: "Please enter a description for the new image",
        variant: "destructive",
      });
      return;
    }

    setIsRegenerating(true);
    regenerateMutation.mutate({
      customPrompt: customPrompt.trim(),
      useCurrentImageAsReference,
    });
  };

  return (
    <>
      <div className="bg-white rounded-lg p-4">
        {imageUrl ? (
          <>
            <div className="flex items-center space-x-4 mb-3">
              <img 
                src={imageUrl}
                alt="Core characters and setting" 
                className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                onClick={() => setShowImageDialog(true)}
                data-testid="img-core-image"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Character & Setting Reference</p>
                <p className="text-sm text-gray-600">This image will guide all other page illustrations</p>
              </div>
            </div>
            
            {storyId && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRegenerateDialog(true)}
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  data-testid="button-regenerate-core"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Regenerate
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center space-x-4 mb-3">
              <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center border-2 border-dashed border-gray-300">
                <Palette className="w-8 h-8 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">No Core Image</p>
                <p className="text-sm text-gray-600">Generate a reference image to guide page illustrations</p>
              </div>
            </div>
            
            {storyId && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRegenerateDialog(true)}
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  data-testid="button-generate-core"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Generate Core Image
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      
      <ImageViewerDialog
        isOpen={showImageDialog}
        onClose={() => setShowImageDialog(false)}
        imageUrl={imageUrl}
        title="Core Character & Setting Image"
      />

      {/* Generate/Regenerate Core Image Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{imageUrl ? "Regenerate Core Image" : "Generate Core Image"}</DialogTitle>
            <DialogDescription>
              {imageUrl 
                ? "Describe how you'd like the core reference image to be modified. This will create a new version while optionally using the current image as reference."
                : "Describe the core reference image for your story. This will help create consistent illustrations for all story pages."
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="core-custom-prompt">Image Description</Label>
              <Textarea
                id="core-custom-prompt"
                placeholder={imageUrl 
                  ? "e.g., Make the forest more magical with glowing flowers, or Change the characters to be wearing winter clothes..."
                  : "e.g., A magical forest with talking animals, A brave princess in a castle, Children exploring a mysterious cave..."
                }
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
                data-testid="textarea-core-prompt"
              />
            </div>
            
            {imageUrl && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="core-use-reference"
                  checked={useCurrentImageAsReference}
                  onCheckedChange={(checked) => setUseCurrentImageAsReference(checked as boolean)}
                  data-testid="checkbox-core-reference"
                />
                <Label htmlFor="core-use-reference" className="text-sm">
                  Use current image as reference (maintains style and character designs)
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRegenerateDialog(false)}
              disabled={isRegenerating}
              data-testid="button-cancel-core-regenerate"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerate}
              disabled={isRegenerating || !customPrompt.trim()}
              data-testid="button-confirm-core-regenerate"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {imageUrl ? "Regenerate Image" : "Generate Image"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StoryCreationWorkflow({ onComplete, existingStory }: StoryCreationWorkflowProps) {
  // Determine initial step based on story completion status
  const getInitialStep = (): WorkflowStep => {
    if (!existingStory) return "details";
    
    // Check what step the story is at based on data completeness
    if (!existingStory.expandedSetting) return "setting";
    if (!existingStory.extractedCharacters || existingStory.extractedCharacters.length === 0) return "characters";
    if (!existingStory.pages || existingStory.pages.length === 0) return "review";
    
    // If story has images, go to images step, otherwise review
    const hasImages = existingStory.pages.some(page => page.imageUrl);
    return hasImages ? "complete" : "images";
  };
  
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(getInitialStep());
  const [generatedStory, setGeneratedStory] = useState<Story | null>(existingStory || null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [editedPages, setEditedPages] = useState<StoryPage[]>(existingStory?.pages || []);
  const [imageGenerationProgress, setImageGenerationProgress] = useState<{ [key: number]: boolean }>({});
  const [expandedSetting, setExpandedSetting] = useState(existingStory?.expandedSetting || "");
  const [extractedCharacters, setExtractedCharacters] = useState<Character[]>(existingStory?.extractedCharacters || []);
  const [showRevisionPanel, setShowRevisionPanel] = useState(!!existingStory);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateStory>({
    resolver: zodResolver(createStorySchema),
    defaultValues: {
      title: existingStory?.title || "",
      setting: existingStory?.setting || "",
      characters: existingStory?.characters || "",
      plot: existingStory?.plot || "",
      totalPages: existingStory?.totalPages || 8,
      ageGroup: (existingStory?.ageGroup as "3-5" | "6-8" | "9-12") || "6-8",
    },
  });

  // Save step mutation for revision system
  const saveStepMutation = useMutation({
    mutationFn: async ({ step, storyData, clearFutureSteps = false }: { 
      step: string; 
      storyData: any; 
      clearFutureSteps?: boolean;
    }) => {
      if (generatedStory) {
        const response = await apiRequest('POST', `/api/stories/${generatedStory.id}/save-step`, { 
          step, 
          storyData, 
          clearFutureSteps 
        });
        return response.json();
      }
    },
    onSuccess: (data) => {
      if (data && data.story) {
        setGeneratedStory(data.story);
        queryClient.invalidateQueries({ queryKey: ['/api/stories'] });
        
        if (data.revisionCreated) {
          toast({
            title: "Revision Created",
            description: `Created revision ${data.revisionNumber} and cleared future steps`,
          });
        }
      }
    },
  });

  const createStoryMutation = useMutation({
    mutationFn: async (data: CreateStory) => {
      const response = await apiRequest("POST", "/api/stories", data);
      return response.json() as Promise<Story>;
    },
    onSuccess: async (story) => {
      setGeneratedStory(story);
      setCurrentStep("setting");
      
      // Create initial revision
      if (story?.id) {
        // Initial revision is created by the backend automatically
      }
      
      // Automatically expand the setting
      try {
        const expandResponse = await apiRequest("POST", `/api/stories/${story.id}/expand-setting`);
        const { expandedSetting } = await expandResponse.json();
        setExpandedSetting(expandedSetting);
        
        toast({
          title: "Story Created!",
          description: "I've expanded your setting. Please review and edit as needed.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to expand setting",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create story",
        variant: "destructive",
      });
    },
  });

  const approveStoryMutation = useMutation({
    mutationFn: async () => {
      if (!generatedStory) throw new Error("No story to approve");
      const response = await apiRequest("POST", `/api/stories/${generatedStory.id}/approve-story`, {
        pages: editedPages,
      });
      return response.json();
    },
    onSuccess: async (data) => {
      setGeneratedStory(data.story);
      setCurrentStep("images");
      
      // Save review step completion
      saveStepMutation.mutate({
        step: "review",
        storyData: { pages: editedPages },
      });
      
      toast({
        title: "Story Approved!",
        description: "Starting image generation...",
      });
      
      // Start image generation process
      if (data.story) {
        await generateAllImages(data.story.id);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve story",
        variant: "destructive",
      });
    },
  });

  // Generate story idea mutation
  const generateStoryIdeaMutation = useMutation({
    mutationFn: async (ageGroup?: string) => {
      const response = await apiRequest("POST", "/api/generate-story-idea", { ageGroup });
      return response.json();
    },
    onSuccess: (data) => {
      // Populate the form with the generated idea
      form.setValue("title", data.title);
      form.setValue("setting", data.setting);
      form.setValue("characters", data.characters);
      form.setValue("plot", data.plot);
      form.setValue("ageGroup", data.ageGroup);
      form.setValue("totalPages", data.totalPages);
      
      toast({
        title: "Story Idea Generated!",
        description: "I've filled in your form with a creative story idea. Feel free to edit any details.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate story idea",
        variant: "destructive",
      });
    },
  });

  const handleGenerateStoryIdea = () => {
    const currentAgeGroup = form.getValues("ageGroup");
    generateStoryIdeaMutation.mutate(currentAgeGroup);
  };

  const generateAllImages = async (storyId: string) => {
    try {
      console.log("Starting image generation for story:", storyId);
      
      // Get the current story to ensure we have the latest data
      const storyResponse = await apiRequest("GET", `/api/stories/${storyId}`);
      const currentStory = await storyResponse.json();
      console.log("Current story data:", currentStory);
      
      if (!currentStory.pages || currentStory.pages.length === 0) {
        throw new Error("No story pages found - cannot generate images");
      }

      // Set loading state for all pages
      const pageProgress: Record<number, boolean> = {};
      currentStory.pages.forEach((page: StoryPage) => {
        pageProgress[page.pageNumber] = true;
      });
      setImageGenerationProgress(pageProgress);

      console.log("Calling generate-images endpoint...");
      // Generate all images at once using the single endpoint
      const response = await apiRequest("POST", `/api/stories/${storyId}/generate-images`);
      const { story: updatedStory } = await response.json();
      console.log("Image generation completed:", updatedStory);
      
      setGeneratedStory(updatedStory);

      // Clear loading state for all pages
      const clearedProgress: Record<number, boolean> = {};
      currentStory.pages.forEach((page: StoryPage) => {
        clearedProgress[page.pageNumber] = false;
      });
      setImageGenerationProgress(clearedProgress);

      // Save images step completion
      saveStepMutation.mutate({
        step: "images",
        storyData: { images: true },
      });
      
      setCurrentStep("complete");
      toast({
        title: "Story Complete!",
        description: "All images have been generated successfully.",
      });

      if (onComplete && updatedStory) {
        onComplete(updatedStory);
      }
    } catch (error) {
      console.error("Image generation error:", error);
      
      // Clear loading state on error
      const clearedProgress: Record<number, boolean> = {};
      // Use editedPages as fallback if we can't get current story
      editedPages.forEach(page => {
        clearedProgress[page.pageNumber] = false;
      });
      setImageGenerationProgress(clearedProgress);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate images",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: CreateStory) => {
    createStoryMutation.mutate(data);
  };

  const updatePageText = (pageIndex: number, text: string) => {
    const updatedPages = [...editedPages];
    updatedPages[pageIndex] = { ...updatedPages[pageIndex], text };
    setEditedPages(updatedPages);
  };

  const updatePageImageGuidance = (pageIndex: number, imageGuidance: string) => {
    const updatedPages = [...editedPages];
    updatedPages[pageIndex] = { ...updatedPages[pageIndex], imageGuidance };
    setEditedPages(updatedPages);
  };

  const approveSettingMutation = useMutation({
    mutationFn: async () => {
      if (!generatedStory) throw new Error("No story to approve");
      const response = await apiRequest("POST", `/api/stories/${generatedStory.id}/approve-setting`, {
        expandedSetting,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedCharacters(data.characters);
      setCurrentStep("characters");
      
      // Save setting step
      saveStepMutation.mutate({
        step: "setting",
        storyData: { expandedSetting },
      });
      
      toast({
        title: "Setting Approved!",
        description: "I've extracted your characters. Please review and edit them.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve setting",
        variant: "destructive",
      });
    },
  });

  const extractCharactersMutation = useMutation({
    mutationFn: async () => {
      if (!generatedStory) throw new Error("No story to extract characters from");
      const response = await apiRequest("POST", `/api/stories/${generatedStory.id}/extract-characters`);
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedCharacters(data.characters || []);
      
      // Save characters extraction step
      saveStepMutation.mutate({
        step: "characters",
        storyData: { extractedCharacters: data.characters },
        clearFutureSteps: true,
      });
      
      toast({
        title: "Characters Extracted!",
        description: "Your characters have been extracted and are ready for review.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to extract characters",
        variant: "destructive",
      });
    },
  });

  const approveCharactersMutation = useMutation({
    mutationFn: async () => {
      if (!generatedStory) throw new Error("No story to approve");
      const response = await apiRequest("POST", `/api/stories/${generatedStory.id}/approve-characters`, {
        characters: extractedCharacters,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedStory(data.story);
      setEditedPages(data.story.pages || []);
      setCurrentStep("review");
      
      // Save characters step
      saveStepMutation.mutate({
        step: "characters",
        storyData: { extractedCharacters },
      });
      
      // Check if pages were actually generated
      if (!data.story.pages || data.story.pages.length === 0) {
        toast({
          title: "Characters Approved!",
          description: "Now generate your story pages to continue.",
        });
      } else {
        toast({
          title: "Story Generated!",
          description: `Your ${data.story.pages.length}-page story has been generated. Please review and edit as needed.`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve characters",
        variant: "destructive",
      });
    },
  });

  const steps = [
    { number: 1, label: "Story Details", completed: !["details"].includes(currentStep), current: currentStep === "details" },
    { number: 2, label: "Expand Setting", completed: !["details", "setting"].includes(currentStep), current: currentStep === "setting" },
    { number: 3, label: "Define Characters", completed: !["details", "setting", "characters"].includes(currentStep), current: currentStep === "characters" },
    { number: 4, label: "Review Story", completed: ["images", "complete"].includes(currentStep), current: currentStep === "review" },
    { number: 5, label: "Generate Images", completed: currentStep === "complete", current: currentStep === "images" },
    { number: 6, label: "Final Story", completed: false, current: currentStep === "complete" },
  ];

  // Function to navigate to a specific step
  const navigateToStep = (step: WorkflowStep) => {
    setCurrentStep(step);
  };

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");

  const updateTitleMutation = useMutation({
    mutationFn: async (newTitle: string) => {
      if (!generatedStory) throw new Error("No story to update");
      const response = await apiRequest("PATCH", `/api/stories/${generatedStory.id}`, {
        title: newTitle,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedStory(data.story);
      setIsEditingTitle(false);
      toast({
        title: "Title Updated!",
        description: "Your story title has been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update title",
        variant: "destructive",
      });
    },
  });

  const handleTitleEdit = () => {
    setTempTitle(generatedStory?.title || "");
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    if (tempTitle.trim() && tempTitle !== generatedStory?.title) {
      updateTitleMutation.mutate(tempTitle.trim());
    } else {
      setIsEditingTitle(false);
    }
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setTempTitle("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Story Title Section */}
      {generatedStory && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {!isEditingTitle ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" data-testid="text-story-title">
                  {generatedStory.title}
                </h1>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTitleEdit}
                  className="ml-2"
                  data-testid="button-edit-title"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") handleTitleCancel();
                  }}
                  className="text-2xl font-bold border-2"
                  autoFocus
                  data-testid="input-edit-title"
                />
                <Button
                  size="sm"
                  onClick={handleTitleSave}
                  disabled={updateTitleMutation.isPending}
                  data-testid="button-save-title"
                >
                  {updateTitleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTitleCancel}
                  data-testid="button-cancel-title"
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <ProgressIndicator steps={steps} onStepClick={(step: string) => navigateToStep(step as WorkflowStep)} />
        <div className="flex flex-wrap gap-2">
          {generatedStory && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRevisionPanel(!showRevisionPanel)}
              className="flex items-center gap-2"
              data-testid="button-toggle-revisions"
            >
              <History className="h-4 w-4" />
              {showRevisionPanel ? "Hide" : "Show"} Revisions
            </Button>
          )}
        </div>
      </div>
      
      <div className={`grid gap-6 ${showRevisionPanel ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
        {/* Main Workflow */}
        <div className={showRevisionPanel ? "lg:col-span-2" : "col-span-1"}>

      {/* Step 1: Story Details Input */}
      {currentStep === "details" && (
        <Card className="bg-white shadow-lg">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Let's Create Your Amazing Story!</h2>
              <p className="text-base sm:text-lg text-gray-600">Tell me about your story idea and I'll help bring it to life with words and pictures.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Generate Story Idea Button - Moved to top */}
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        onClick={handleGenerateStoryIdea}
                        disabled={generateStoryIdeaMutation.isPending}
                        variant="outline"
                        className="w-full sm:w-auto border-2 border-purple-300 hover:border-purple-400 text-purple-700 hover:text-purple-800 px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-sm sm:text-base font-medium shadow-md hover:shadow-lg transition-all"
                        data-testid="button-generate-idea"
                      >
                        {generateStoryIdeaMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Idea...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Story Idea for Me
                          </>
                        )}
                      </Button>
                    </div>
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg font-semibold text-gray-900 flex items-center">
                            <BookOpen className="text-purple-600 mr-2" size={20} />
                            Story Title
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="What should we call your amazing story?"
                              className="border-2 border-gray-200 focus:border-indigo-600"
                              {...field}
                              data-testid="input-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="setting"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg font-semibold text-gray-900 flex items-center">
                            <BookOpen className="text-indigo-600 mr-2" size={20} />
                            Story Setting
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Where does your story take place? (e.g., a magical forest, a space station, an underwater kingdom...)"
                              className="min-h-[80px] border-2 border-gray-200 focus:border-indigo-600"
                              {...field}
                              data-testid="input-setting"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="characters"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg font-semibold text-gray-900 flex items-center">
                            <Users className="text-amber-500 mr-2" size={20} />
                            Main Characters
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Who are the heroes of your story? Describe them! (e.g., a brave little mouse, a friendly dragon, a curious princess...)"
                              className="min-h-[80px] border-2 border-gray-200 focus:border-indigo-600"
                              {...field}
                              data-testid="input-characters"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="plot"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg font-semibold text-gray-900 flex items-center">
                            <ScrollText className="text-emerald-500 mr-2" size={20} />
                            Plot & Adventure
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="What exciting adventure happens in your story? What problem do they solve? (e.g., they must find a lost treasure, save their friends, learn a valuable lesson...)"
                              className="min-h-[100px] border-2 border-gray-200 focus:border-indigo-600"
                              {...field}
                              data-testid="input-plot"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="storyGuidance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg font-semibold text-gray-900 flex items-center">
                            <Sparkles className="text-purple-500 mr-2" size={20} />
                            Story Guidance (Optional)
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add guidance for tone, perspective, lessons learned, or mood (e.g., uplifting and encouraging, teaches about friendship, funny and lighthearted...)"
                              className="min-h-[80px] border-2 border-gray-200 focus:border-indigo-600"
                              {...field}
                              data-testid="input-story-guidance"
                            />
                          </FormControl>
                          <p className="text-sm text-gray-500 mt-1">
                            This guidance will be applied to all text and image generation for your story
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="totalPages"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                              <BookOpen className="text-pink-500 mr-2" size={16} />
                              Story Length
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={5}
                                max={50}
                                placeholder="8"
                                className="border-2 border-gray-200 focus:border-indigo-600"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  if (!isNaN(value)) {
                                    field.onChange(value);
                                  }
                                }}
                                data-testid="input-pages"
                              />
                            </FormControl>
                            <p className="text-sm text-gray-500 mt-1">
                              Choose between 5-50 pages for your story
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ageGroup"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                              <Users className="text-indigo-600 mr-2" size={16} />
                              Age Group
                            </FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="border-2 border-gray-200 focus:border-indigo-600" data-testid="select-age-group">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="3-5">Ages 3-5</SelectItem>
                                <SelectItem value="6-8">Ages 6-8</SelectItem>
                                <SelectItem value="9-12">Ages 9-12</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>


                    <div className="flex justify-center mt-4 sm:mt-6">
                      <Button
                        type="submit"
                        disabled={createStoryMutation.isPending}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                        data-testid="button-generate-story"
                      >
                        {createStoryMutation.isPending ? (
                          <>
                            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                            Creating Your Story...
                          </>
                        ) : (
                          <>
                            <Palette className="mr-3 h-5 w-5" />
                            Generate My Story!
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>

              {/* Preview Panel */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Eye className="text-indigo-600 mr-2" size={16} />
                  Story Preview
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border-l-4 border-purple-400">
                    <h4 className="font-semibold text-gray-900 mb-2">Setting:</h4>
                    <p className="text-gray-700">{form.watch("setting") || "Enter your story setting..."}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border-l-4 border-amber-400">
                    <h4 className="font-semibold text-gray-900 mb-2">Characters:</h4>
                    <p className="text-gray-700">{form.watch("characters") || "Describe your main characters..."}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border-l-4 border-emerald-400">
                    <h4 className="font-semibold text-gray-900 mb-2">Adventure:</h4>
                    <p className="text-gray-700">{form.watch("plot") || "What exciting adventure happens..."}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span><BookOpen className="inline mr-1" size={16} />{form.watch("totalPages")} Pages</span>
                      <span><Users className="inline mr-1" size={16} />Ages {form.watch("ageGroup")}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Setting Expansion */}
      {currentStep === "setting" && (
        <Card className="bg-white shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Let's Expand Your Setting!</h2>
              <p className="text-lg text-gray-600">I've enriched your story setting. Please review and edit as needed.</p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <label className="block text-lg font-semibold text-gray-900 mb-3">
                  Expanded Setting Description
                </label>
                <Textarea
                  value={expandedSetting}
                  onChange={(e) => setExpandedSetting(e.target.value)}
                  className="min-h-[200px] border-2 border-gray-200 focus:border-indigo-600 text-base"
                  placeholder="Your expanded setting will appear here..."
                  data-testid="textarea-expanded-setting"
                />
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={() => approveSettingMutation.mutate()}
                  disabled={approveSettingMutation.isPending || !expandedSetting.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold"
                  data-testid="button-approve-setting"
                >
                  {approveSettingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="mr-3 h-5 w-5" />
                      Approve & Continue
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Character Definition */}
      {currentStep === "characters" && (
        <Card className="bg-white shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Meet Your Characters!</h2>
              <p className="text-lg text-gray-600">I've extracted and detailed your characters. Please review and edit them.</p>
            </div>

            <div className="max-w-4xl mx-auto">
              {!extractedCharacters || extractedCharacters.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mb-4">
                    <p className="text-gray-500 mb-4">
                      {extractCharactersMutation.isPending ? "Extracting characters from your story..." : "No characters extracted yet."}
                    </p>
                    <Button
                      onClick={() => extractCharactersMutation.mutate()}
                      disabled={extractCharactersMutation.isPending || !generatedStory}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold"
                      data-testid="button-extract-characters"
                    >
                      {extractCharactersMutation.isPending ? (
                        <>
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                          Extracting Characters...
                        </>
                      ) : (
                        <>
                          <Users className="mr-3 h-5 w-5" />
                          Extract Characters
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                extractedCharacters.map((character, index) => (
                <div key={index} className="mb-6 p-6 bg-gray-50 rounded-xl">
                  <div className="mb-4">
                    <label className="block text-lg font-semibold text-gray-900 mb-2">
                      Character Name
                    </label>
                    <Input
                      value={character.name}
                      onChange={(e) => {
                        const updated = [...(extractedCharacters || [])];
                        updated[index].name = e.target.value;
                        setExtractedCharacters(updated);
                      }}
                      className="border-2 border-gray-200 focus:border-indigo-600"
                      data-testid={`input-character-name-${index}`}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-lg font-semibold text-gray-900 mb-2">
                      Character Description
                    </label>
                    <Textarea
                      value={character.description}
                      onChange={(e) => {
                        const updated = [...(extractedCharacters || [])];
                        updated[index].description = e.target.value;
                        setExtractedCharacters(updated);
                      }}
                      className="min-h-[100px] border-2 border-gray-200 focus:border-indigo-600"
                      data-testid={`textarea-character-description-${index}`}
                    />
                  </div>
                </div>
                ))
              )}

              {extractedCharacters && extractedCharacters.length > 0 && (
                <div className="flex flex-wrap gap-4 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => extractCharactersMutation.mutate()}
                    disabled={extractCharactersMutation.isPending}
                    className="px-6 py-3 font-medium"
                    data-testid="button-regenerate-characters"
                  >
                    {extractCharactersMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Users className="mr-2 h-4 w-4" />
                        Regenerate Characters
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => approveCharactersMutation.mutate()}
                    disabled={approveCharactersMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold"
                    data-testid="button-approve-characters"
                  >
                    {approveCharactersMutation.isPending ? (
                      <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        Generating Story...
                      </>
                    ) : (
                      <>
                        <ScrollText className="mr-3 h-5 w-5" />
                        Generate Story Text
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Story Review */}
      {currentStep === "review" && generatedStory && (
        <Card className="bg-white shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Review Your Story</h2>
              <p className="text-lg text-gray-600">
                {!editedPages || editedPages.length === 0 
                  ? "Generate your story pages to start reviewing and editing!"
                  : "Read through your story and make any changes before we create the pictures!"
                }
              </p>
            </div>

            {!editedPages || editedPages.length === 0 ? (
              /* No Pages - Show Generation Interface */
              <div className="text-center py-8">
                <div className="mb-6">
                  <p className="text-gray-500 mb-4">No story pages generated yet.</p>
                  <div className="mb-4">
                    <label className="block text-lg font-semibold text-gray-900 mb-2">
                      Number of Pages
                    </label>
                    <Select
                      value={form.watch("totalPages").toString()}
                      onValueChange={(value) => form.setValue("totalPages", parseInt(value))}
                    >
                      <SelectTrigger className="w-48 mx-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} pages
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => approveCharactersMutation.mutate()}
                    disabled={approveCharactersMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold"
                    data-testid="button-generate-pages"
                  >
                    {approveCharactersMutation.isPending ? (
                      <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        Generating Story Pages...
                      </>
                    ) : (
                      <>
                        <ScrollText className="mr-3 h-5 w-5" />
                        Generate Story Pages
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* Pages Exist - Show Review Interface */
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Story Pages List */}
                  <div className="lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900">Story Pages</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => approveCharactersMutation.mutate()}
                        disabled={approveCharactersMutation.isPending}
                        data-testid="button-regenerate-pages"
                      >
                        {approveCharactersMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Regenerate"
                        )}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {editedPages && editedPages.length > 0 ? (
                        editedPages.map((page, index) => (
                          <div
                            key={page.pageNumber}
                            className={`bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors border-l-4 ${
                              index === currentPageIndex ? "border-indigo-600" : "border-gray-300"
                            }`}
                            onClick={() => setCurrentPageIndex(index)}
                            data-testid={`page-${page.pageNumber}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">Page {page.pageNumber}</span>
                              <Edit className="text-gray-400" size={16} />
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{page.text ? page.text.substring(0, 60) + '...' : 'No content'}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          No pages found. Try regenerating the story.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Story Editor */}
                  <div className="lg:col-span-2">
                    {editedPages && editedPages.length > 0 && editedPages[currentPageIndex] ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-gray-900">Page {editedPages[currentPageIndex].pageNumber}</h3>
                        </div>

                        <Textarea
                          value={editedPages[currentPageIndex].text || ""}
                          onChange={(e) => updatePageText(currentPageIndex, e.target.value)}
                          className="w-full h-64 p-4 border-2 border-gray-200 focus:border-indigo-600 resize-none"
                          data-testid="textarea-page-content"
                        />

                        <div className="mt-4">
                          <Label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                            <Palette className="text-purple-500 mr-2" size={16} />
                            Image Guidance for This Page (Optional)
                          </Label>
                          <Textarea
                            value={editedPages[currentPageIndex].imageGuidance || ""}
                            onChange={(e) => updatePageImageGuidance(currentPageIndex, e.target.value)}
                            placeholder="Add specific guidance for this page's image (e.g., cozy indoor scene, action-packed adventure, close-up of characters...)"
                            className="w-full h-20 p-3 border-2 border-gray-200 focus:border-indigo-600 resize-none text-sm"
                            data-testid="textarea-page-image-guidance"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            This guidance will be used when generating the image for this specific page
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                              disabled={currentPageIndex === 0}
                              data-testid="button-previous-page"
                            >
                              Previous
                            </Button>
                            <Button
                              onClick={() => setCurrentPageIndex(Math.min(editedPages.length - 1, currentPageIndex + 1))}
                              disabled={currentPageIndex === editedPages.length - 1}
                              data-testid="button-next-page"
                            >
                              Next
                            </Button>
                          </div>
                          
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Word count:</span> {editedPages[currentPageIndex].text ? editedPages[currentPageIndex].text.split(/\s+/).length : 0} words
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No page selected or available</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Approval Actions */}
                <div className="flex flex-wrap gap-4 justify-center mt-8 pt-6 border-t border-gray-200">
                  <Button
                    variant="outline"
                    className="px-6 py-3 font-medium"
                    data-testid="button-keep-editing"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Keep Editing
                  </Button>
                  <Button
                    onClick={() => approveStoryMutation.mutate()}
                    disabled={approveStoryMutation.isPending}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 font-medium shadow-lg"
                    data-testid="button-approve-story"
                  >
                    {approveStoryMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Approve Story & Create Images
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Image Generation */}
      {currentStep === "images" && generatedStory && (
        <Card className="bg-white shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Creating Your Story Images</h2>
              <p className="text-lg text-gray-600">AI is painting beautiful pictures for each page of your story!</p>
            </div>

            <div className="space-y-6">
              {/* Core Character/Setting Image */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Palette className="text-indigo-600 mr-2" size={20} />
                    Core Character & Setting Image
                  </h3>
                  <div className="flex items-center text-emerald-600">
                    <Check className="mr-2" size={16} />
                    <span className="font-medium">Complete</span>
                  </div>
                </div>
                
                {generatedStory.coreImageUrl && (
                  <CoreImageDisplay 
                    imageUrl={generatedStory.coreImageUrl}
                    storyId={generatedStory.id}
                    onImageRegenerated={(updatedStory) => setGeneratedStory(updatedStory)}
                  />
                )}
              </div>

              {/* Page Images Progress */}
              <div className="space-y-6">
                {editedPages.map((page) => {
                  const isGenerating = imageGenerationProgress[page.pageNumber];
                  const storyPage = generatedStory.pages.find(p => p.pageNumber === page.pageNumber);
                  const hasImage = storyPage?.imageUrl;
                  
                  return (
                    <PageImageCard
                      key={page.pageNumber}
                      page={page}
                      storyPage={storyPage}
                      isGenerating={isGenerating}
                      hasImage={hasImage}
                      storyId={generatedStory.id}
                      onImageRegenerated={(updatedStory) => setGeneratedStory(updatedStory)}
                    />
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Story Complete */}
      {currentStep === "complete" && generatedStory && (
        <Card className="bg-white shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="mb-4 p-4 bg-green-100 border border-green-300 rounded-lg inline-flex items-center">
                <Check className="text-green-600 mr-2" size={24} />
                <p className="text-green-800 font-semibold">
                  🎉 Your story is complete!
                </p>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                {generatedStory.title}
              </h2>
              <p className="text-lg text-gray-600">
                Your {generatedStory.pages.length}-page story is ready with beautiful illustrations!
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Story Preview */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                  <BookOpen className="text-indigo-600 mr-2" />
                  Story Preview
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-4 p-4 bg-gray-50 rounded-lg">
                  {generatedStory.pages.map((page) => (
                    <div key={page.pageNumber} className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="flex items-center mb-2">
                        <span className="text-sm font-medium text-indigo-600">
                          Page {page.pageNumber}
                        </span>
                        {page.imageUrl && (
                          <span className="ml-2 text-xs text-green-600 flex items-center">
                            <Check className="w-3 h-3 mr-1" />
                            Image
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {page.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Image Display */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Palette className="text-indigo-600 mr-2" />
                  Story Artwork
                </h3>
                <CoreImageDisplay 
                  imageUrl={generatedStory.coreImageUrl || ""}
                  storyId={generatedStory.id}
                  onImageRegenerated={(updatedStory) => setGeneratedStory(updatedStory)}
                />
                
                {/* Character Gallery */}
                {generatedStory.extractedCharacters && generatedStory.extractedCharacters.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Users className="text-indigo-600 mr-2" size={20} />
                      Characters
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {generatedStory.extractedCharacters.map((character, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg border">
                          <h5 className="font-medium text-gray-900">{character.name}</h5>
                          <p className="text-sm text-gray-600 mt-1">{character.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 justify-center mt-8 pt-6 border-t border-gray-200">
              <Button
                onClick={() => onComplete?.(generatedStory)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2"
                data-testid="button-read-story"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Read Full Story
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentStep("images")}
                data-testid="button-edit-images"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Images
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentStep("review")}
                data-testid="button-edit-text"
              >
                <ScrollText className="w-4 h-4 mr-2" />
                Edit Story Text
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
        </div>
        
        {/* Revision Panel */}
        {showRevisionPanel && generatedStory && (
          <div className="lg:col-span-1">
            <RevisionPanel
              storyId={generatedStory.id}
              currentRevision={generatedStory.currentRevision || 1}
              onRevisionLoaded={() => {
                // Refresh story data when revision is loaded
                queryClient.invalidateQueries({ queryKey: ['/api/stories', generatedStory.id] });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

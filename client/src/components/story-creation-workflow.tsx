import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { RevisionPanel } from "@/components/revision-panel";
import { Loader2, BookOpen, Users, ScrollText, Palette, Eye, Edit, Check, Plus, History, RefreshCw, Sparkles } from "lucide-react";

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
  const { toast } = useToast();

  const regenerateImageMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest("POST", `/api/stories/${storyId}/pages/${page.pageNumber}/regenerate-image`, {
        customPrompt: prompt,
      });
      return response.json();
    },
    onSuccess: (data) => {
      onImageRegenerated(data.story);
      setIsRegenerating(false);
      setShowCustomPrompt(false);
      setCustomPrompt("");
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
    if (customPrompt.trim()) {
      setIsRegenerating(true);
      regenerateImageMutation.mutate(customPrompt.trim());
    } else {
      toast({
        title: "Custom prompt required",
        description: "Please enter a custom prompt to guide the image generation.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-start gap-6">
        {/* Image Section */}
        <div className="flex-shrink-0">
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
                className="w-32 h-32 rounded-lg object-cover"
              />
            ) : (
              <div className="text-center text-gray-400">
                <Palette size={32} className="mx-auto mb-2" />
                <p className="text-xs">Waiting...</p>
              </div>
            )}
          </div>
          
          {/* Regenerate Button */}
          {hasImage && !isGenerating && !isRegenerating && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustomPrompt(!showCustomPrompt)}
              className="w-full mt-3 flex items-center gap-2"
              data-testid={`button-regenerate-page-${page.pageNumber}`}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
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
                <span className="text-sm text-gray-500">Queued</span>
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
                Custom Image Prompt
              </h5>
              <div className="space-y-3">
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Describe how you want this page image to look different. For example: 'Make the forest more magical with glowing fireflies and sparkles in the air'"
                  className="resize-none"
                  rows={3}
                  data-testid={`input-custom-prompt-${page.pageNumber}`}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={regenerateImageMutation.isPending || !customPrompt.trim()}
                    data-testid={`button-apply-prompt-${page.pageNumber}`}
                  >
                    {regenerateImageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    Apply Changes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCustomPrompt(false);
                      setCustomPrompt("");
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
    </div>
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
              <div className="mb-4 p-3 bg-amber-100 border border-amber-300 rounded-lg inline-block">
                <p className="text-amber-800 text-xs sm:text-sm font-medium">
                  🎭 Demo Mode: Using sample content while OpenAI quota is resolved
                </p>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Let's Create Your Amazing Story!</h2>
              <p className="text-base sm:text-lg text-gray-600">Tell me about your story idea and I'll help bring it to life with words and pictures.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            <Select value={field.value.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                              <FormControl>
                                <SelectTrigger className="border-2 border-gray-200 focus:border-indigo-600" data-testid="select-pages">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="5">5 Pages (Short)</SelectItem>
                                <SelectItem value="8">8 Pages (Medium)</SelectItem>
                                <SelectItem value="12">12 Pages (Long)</SelectItem>
                              </SelectContent>
                            </Select>
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

                    <div className="flex justify-center mt-6 sm:mt-8">
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
                <div className="flex justify-center space-x-4">
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

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-2">
                          <div className="flex space-x-2">
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
                <div className="flex justify-center space-x-4 mt-8 pt-6 border-t border-gray-200">
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
                  <div className="bg-white rounded-lg p-4 flex items-center space-x-4">
                    <img 
                      src={generatedStory.coreImageUrl}
                      alt="Core characters and setting" 
                      className="w-20 h-20 rounded-lg object-cover" 
                    />
                    <div>
                      <p className="font-medium text-gray-900">Character & Setting Reference</p>
                      <p className="text-sm text-gray-600">This image will guide all other page illustrations</p>
                    </div>
                  </div>
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

      {/* Step 4: Story Complete - This will be handled by parent component */}
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

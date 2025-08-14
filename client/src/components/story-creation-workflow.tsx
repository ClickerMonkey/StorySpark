import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStorySchema, type CreateStory, type Story, type StoryPage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { Loader2, BookOpen, Users, ScrollText, Palette, Eye, Edit, Check, Plus } from "lucide-react";

type WorkflowStep = "details" | "review" | "images" | "complete";

interface StoryCreationWorkflowProps {
  onComplete?: (story: Story) => void;
}

export function StoryCreationWorkflow({ onComplete }: StoryCreationWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("details");
  const [generatedStory, setGeneratedStory] = useState<Story | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [editedPages, setEditedPages] = useState<StoryPage[]>([]);
  const [imageGenerationProgress, setImageGenerationProgress] = useState<{ [key: number]: boolean }>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateStory>({
    resolver: zodResolver(createStorySchema),
    defaultValues: {
      setting: "",
      characters: "",
      plot: "",
      totalPages: 8,
      ageGroup: "6-8",
    },
  });

  const createStoryMutation = useMutation({
    mutationFn: async (data: CreateStory) => {
      const response = await apiRequest("POST", "/api/stories", data);
      return response.json() as Promise<Story>;
    },
    onSuccess: (story) => {
      setGeneratedStory(story);
      setEditedPages(story.pages);
      setCurrentStep("review");
      toast({
        title: "Story Generated!",
        description: "Your story has been created. Please review and edit as needed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate story",
        variant: "destructive",
      });
    },
  });

  const approveStoryMutation = useMutation({
    mutationFn: async () => {
      if (!generatedStory) throw new Error("No story to approve");
      const response = await apiRequest("POST", `/api/stories/${generatedStory.id}/approve`, {
        pages: editedPages,
      });
      return response.json();
    },
    onSuccess: async () => {
      setCurrentStep("images");
      toast({
        title: "Story Approved!",
        description: "Starting image generation...",
      });
      
      // Start image generation process
      if (generatedStory) {
        await generateAllImages(generatedStory.id);
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
      // Generate core image first
      const coreResponse = await apiRequest("POST", `/api/stories/${storyId}/generate-core-image`);
      const { story: updatedStory } = await coreResponse.json();
      setGeneratedStory(updatedStory);

      // Generate page images sequentially
      for (let i = 0; i < editedPages.length; i++) {
        const pageNumber = editedPages[i].pageNumber;
        setImageGenerationProgress(prev => ({ ...prev, [pageNumber]: true }));
        
        try {
          const pageResponse = await apiRequest("POST", `/api/stories/${storyId}/pages/${pageNumber}/generate-image`);
          const { story: pageUpdatedStory } = await pageResponse.json();
          setGeneratedStory(pageUpdatedStory);
          setImageGenerationProgress(prev => ({ ...prev, [pageNumber]: false }));
        } catch (error) {
          console.error(`Error generating image for page ${pageNumber}:`, error);
          setImageGenerationProgress(prev => ({ ...prev, [pageNumber]: false }));
        }
      }

      setCurrentStep("complete");
      toast({
        title: "Story Complete!",
        description: "All images have been generated successfully.",
      });

      if (onComplete && generatedStory) {
        onComplete(generatedStory);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate images",
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

  const steps = [
    { number: 1, label: "Story Details", completed: currentStep !== "details", current: currentStep === "details" },
    { number: 2, label: "Review Story", completed: ["images", "complete"].includes(currentStep), current: currentStep === "review" },
    { number: 3, label: "Generate Images", completed: currentStep === "complete", current: currentStep === "images" },
    { number: 4, label: "Final Story", completed: false, current: currentStep === "complete" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ProgressIndicator steps={steps} />

      {/* Step 1: Story Details Input */}
      {currentStep === "details" && (
        <Card className="bg-white shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="mb-4 p-3 bg-amber-100 border border-amber-300 rounded-lg inline-block">
                <p className="text-amber-800 text-sm font-medium">
                  🎭 Demo Mode: Using sample content while OpenAI quota is resolved
                </p>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Let's Create Your Amazing Story!</h2>
              <p className="text-lg text-gray-600">Tell me about your story idea and I'll help bring it to life with words and pictures.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="totalPages"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-lg font-semibold text-gray-900 flex items-center">
                              <BookOpen className="text-pink-500 mr-2" size={20} />
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
                            <FormLabel className="text-lg font-semibold text-gray-900 flex items-center">
                              <Users className="text-indigo-600 mr-2" size={20} />
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

                    <div className="flex justify-center mt-8">
                      <Button
                        type="submit"
                        disabled={createStoryMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
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
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Eye className="text-indigo-600 mr-2" size={20} />
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

      {/* Step 2: Story Review */}
      {currentStep === "review" && generatedStory && (
        <Card className="bg-white shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Review Your Story</h2>
              <p className="text-lg text-gray-600">Read through your story and make any changes before we create the pictures!</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Story Pages List */}
              <div className="lg:col-span-1">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Story Pages</h3>
                <div className="space-y-2">
                  {editedPages.map((page, index) => (
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
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{page.text.substring(0, 60)}...</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Story Editor */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Page {editedPages[currentPageIndex]?.pageNumber}</h3>
                </div>

                <Textarea
                  value={editedPages[currentPageIndex]?.text || ""}
                  onChange={(e) => updatePageText(currentPageIndex, e.target.value)}
                  className="w-full h-64 p-4 border-2 border-gray-200 focus:border-indigo-600 resize-none"
                  data-testid="textarea-page-content"
                />

                <div className="flex justify-between items-center mt-4">
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
                    <span className="font-medium">Word count:</span> {editedPages[currentPageIndex]?.text.split(/\s+/).length || 0} words
                  </div>
                </div>
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
              <div className="space-y-4">
                {editedPages.map((page) => {
                  const isGenerating = imageGenerationProgress[page.pageNumber];
                  const hasImage = generatedStory.pages.find(p => p.pageNumber === page.pageNumber)?.imageUrl;
                  
                  return (
                    <div key={page.pageNumber} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        {isGenerating ? (
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                        ) : hasImage ? (
                          <img 
                            src={hasImage}
                            alt={`Page ${page.pageNumber}`}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="text-gray-400">
                            <Palette size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Page {page.pageNumber} Image</h4>
                        <p className="text-sm text-gray-600">
                          {isGenerating 
                            ? "Generating image..." 
                            : hasImage 
                              ? "Image complete" 
                              : "Waiting in queue..."
                          }
                        </p>
                      </div>
                      <span className="text-sm text-gray-500">
                        {hasImage ? "Complete" : isGenerating ? "Generating..." : "Queued"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Story Complete - This will be handled by parent component */}
    </div>
  );
}

import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type Story } from "@shared/schema";
import { StoryCreationWorkflow } from "@/components/story-creation-workflow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ArrowLeft } from "lucide-react";

export default function StoryEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: story, isLoading, error } = useQuery<Story>({
    queryKey: [`/api/stories/${id}`],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/library">
                <div className="flex items-center space-x-3 cursor-pointer">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-xl flex items-center justify-center">
                    <BookOpen className="text-white" size={20} />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">StoryMaker AI</h1>
                </div>
              </Link>
              
              <Link href="/library">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancel Edit
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="bg-white shadow-lg overflow-hidden">
            <Skeleton className="w-full h-48" />
            <CardContent className="p-8">
              <Skeleton className="h-8 w-3/4 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6 mb-8" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Story Not Found</h2>
            <p className="text-gray-600 mb-4">
              The story you're trying to edit doesn't exist or couldn't be loaded.
            </p>
            <Link href="/library">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Library
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/library">
              <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="text-white" size={16} />
                </div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Edit Story</h1>
              </div>
            </Link>
            
            <Link href={`/story/${story.id}`}>
              <Button variant="ghost" className="text-gray-600 hover:text-gray-900 px-2 sm:px-4" data-testid="button-cancel-edit">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cancel Edit</span>
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="py-4 sm:py-8">
        <StoryCreationWorkflow 
          existingStory={story}
          onComplete={(updatedStory) => {
            // Navigate back to the story view when editing is complete
            setLocation(`/story/${updatedStory.id}`);
          }}
        />
      </div>
    </div>
  );
}
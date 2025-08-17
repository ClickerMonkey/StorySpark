import { useState } from "react";
import { type Story } from "@shared/schema";
import { StoryCreationWorkflow } from "@/components/story-creation-workflow";
import { StoryReader } from "@/components/story-reader";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const [completedStory, setCompletedStory] = useState<Story | null>(null);
  const [showWorkflow, setShowWorkflow] = useState(true);

  const handleStoryComplete = (story: Story) => {
    setCompletedStory(story);
    setShowWorkflow(false);
  };

  const handleNewStory = () => {
    setCompletedStory(null);
    setShowWorkflow(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-xl flex items-center justify-center">
                <BookOpen className="text-white" size={16} />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">StoryMaker AI</h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/library">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900 px-2 sm:px-4" data-testid="link-my-stories">
                  <BookOpen className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">My Stories</span>
                </Button>
              </Link>
              <Button 
                onClick={handleNewStory} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-2 sm:px-4"
                data-testid="button-new-story"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Story</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {showWorkflow && (
          <StoryCreationWorkflow onComplete={handleStoryComplete} />
        )}
        
        {completedStory && !showWorkflow && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
            <StoryReader 
              story={completedStory}
              onEdit={handleNewStory}
              onSave={() => {
                // TODO: Implement save to library functionality
                console.log("Save to library");
              }}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-lg flex items-center justify-center">
                <BookOpen className="text-white text-sm" />
              </div>
              <span className="text-lg font-bold text-gray-900">StoryMaker AI</span>
            </div>
            <p className="text-gray-600 mb-4">Creating magical stories for kids, one adventure at a time.</p>
            <div className="flex justify-center space-x-6 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Help & Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

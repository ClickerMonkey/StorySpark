import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Story } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageViewerDialog } from "@/components/image-viewer-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Plus, Calendar, Users, MoreHorizontal, Settings, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function StoryLibrary() {
  const [, setLocation] = useLocation();
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);
  const { user } = useAuth();

  const { data: stories, isLoading, error } = useQuery<Story[]>({
    queryKey: ["/api/stories"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="text-white" size={20} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">StoryMaker AI</h1>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900">My Story Library</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="w-full h-48" />
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <div className="flex justify-between mb-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Stories</h2>
            <p className="text-gray-600 mb-4">
              We couldn't load your story library. Please try again.
            </p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 cursor-pointer">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="text-white" size={16} />
                </div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">StoryMaker AI</h1>
              </div>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-2 sm:px-4" data-testid="button-create-new">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create New Story</span>
                </Button>
              </Link>
              
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-user-menu">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl || ""} alt={user.name || ""} />
                        <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        {user.name && <p className="font-medium">{user.name}</p>}
                        {user.email && <p className="w-[200px] truncate text-sm text-muted-foreground">{user.email}</p>}
                      </div>
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="w-full cursor-pointer" data-testid="link-profile">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Profile & Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.location.href = "/api/auth/logout"} data-testid="button-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">My Story Library</h2>
          <Link href="/">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium w-full sm:w-auto" data-testid="button-create-story">
              <Plus className="mr-2 h-4 w-4" />
              Create New Story
            </Button>
          </Link>
        </div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* Existing Stories */}
          {stories?.map((story) => (
            <Card key={story.id} className="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">
              {/* Story Cover Image */}
              <div className="w-full h-48 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                {story.coreImageUrl ? (
                  <img 
                    src={story.coreImageUrl}
                    alt={`${story.title} cover`}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomedImage({ url: story.coreImageUrl!, title: `${story.title} Cover Image` });
                    }}
                  />
                ) : (
                  <div className="text-gray-400">
                    <BookOpen size={48} />
                  </div>
                )}
              </div>
              
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 line-clamp-2" data-testid={`story-title-${story.id}`}>{story.title}</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 line-clamp-2">
                  {story.pages[0]?.text.substring(0, 80)}...
                </p>
                
                <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm text-gray-500 mb-4">
                  <span className="flex items-center"><BookOpen className="inline mr-1" size={12} /><span className="truncate">{story.totalPages}p</span></span>
                  <span className="flex items-center justify-center"><Users className="inline mr-1" size={12} /><span className="truncate">{story.ageGroup}</span></span>
                  <span className="flex items-center justify-end"><Calendar className="inline mr-1" size={12} /><span className="truncate">{formatDate(new Date(story.createdAt))}</span></span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button 
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
                    onClick={() => {
                      setLocation(`/story/${story.id}`);
                    }}
                    data-testid={`button-read-${story.id}`}
                  >
                    <BookOpen className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">Read</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="px-2"
                    data-testid={`button-options-${story.id}`}
                  >
                    <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add New Story Card */}
          <Link href="/?new=true">
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-dashed border-purple-300 hover:border-purple-400 transition-colors cursor-pointer h-full min-h-[320px]" data-testid="card-create-new">
              <CardContent className="p-4 sm:p-6 h-full flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center mb-3 sm:mb-4">
                  <Plus size={24} className="sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Create New Story</h3>
                <p className="text-gray-600 text-xs sm:text-sm">Start a magical new adventure!</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Empty State */}
        {stories?.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="text-white" size={48} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">No Stories Yet</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              You haven't created any stories yet. Start your first magical adventure today!
            </p>
            <Link href="/">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-3">
                <Plus className="mr-2 h-5 w-5" />
                Create Your First Story
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Image Viewer Dialog */}
      {zoomedImage && (
        <ImageViewerDialog
          isOpen={true}
          onClose={() => setZoomedImage(null)}
          imageUrl={zoomedImage.url}
          title={zoomedImage.title}
        />
      )}
    </div>
  );
}

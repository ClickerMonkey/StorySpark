import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Story } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getPageImageUrl, getCoreImageUrl } from '@/utils/imageUrl';

interface PDFExportProps {
  story: Story;
  className?: string;
}

export function PDFExport({ story, className }: PDFExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      // Landscape format for folding in the middle
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4' // 297x210mm in landscape
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const halfWidth = pageWidth / 2;

      // Page 1: Back cover (blank) + Front cover with core image and title
      // Left side (back cover) - blank
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, halfWidth, pageHeight, 'F');

      // Right side (front cover)
      const coreImageUrl = getCoreImageUrl(story);
      if (coreImageUrl) {
        try {
          // Load and add the core image
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = coreImageUrl;
          });

          // Create canvas for the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);

          // Add image to right side of first page
          const imageData = canvas.toDataURL('image/jpeg', 0.95);
          const imgHeight = halfWidth * (img.height / img.width);
          const yOffset = (pageHeight - imgHeight) / 2;
          
          pdf.addImage(imageData, 'JPEG', halfWidth, yOffset, halfWidth, imgHeight);
        } catch (error) {
          console.warn('Failed to load core image:', error);
          // Continue without image
        }
      }

      // Add title overlay at bottom of right side with better contrast
      pdf.setFontSize(24);
      pdf.setFont(undefined, 'bold');
      
      // Add solid background for title
      const titleY = pageHeight - 20;
      pdf.setFillColor(0, 0, 0);  // Solid black background
      pdf.rect(halfWidth, titleY - 12, halfWidth, 24, 'F');
      
      // White text on black background for maximum contrast
      pdf.setTextColor(255, 255, 255);
      const titleWidth = pdf.getTextWidth(story.title);
      const titleX = halfWidth + (halfWidth - titleWidth) / 2;
      pdf.text(story.title, titleX, titleY);

      // Add story pages - one page per PDF page for better compatibility
      for (let i = 0; i < story.pages.length; i++) {
        pdf.addPage();
        
        const currentPage = story.pages[i];

        // Left side - always show text, centered and larger with proper contrast
        pdf.setFont(undefined, 'normal');
        
        // Add page number in top corner with proper contrast
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);  // Solid black
        pdf.text(`${currentPage.pageNumber}`, 15, 15);
        
        // Add text with word wrapping, larger and centered with solid black color
        pdf.setFontSize(16);
        pdf.setTextColor(0, 0, 0);  // Ensure solid black text
        const textLines = pdf.splitTextToSize(currentPage.text, halfWidth - 30);
        
        // Calculate vertical centering
        const lineHeight = 8;
        const totalTextHeight = textLines.length * lineHeight;
        const startY = (pageHeight - totalTextHeight) / 2;
        
        // Center text horizontally and vertically with explicit black color
        textLines.forEach((line: string, index: number) => {
          pdf.setTextColor(0, 0, 0);  // Reset to black for each line
          const lineWidth = pdf.getTextWidth(line);
          const centerX = (halfWidth - lineWidth) / 2;
          pdf.text(line, centerX, startY + (index * lineHeight));
        });

        // Right side - show image if available
        const pageImageUrl = getPageImageUrl(currentPage);
        if (pageImageUrl) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = pageImageUrl;
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);

            const imageData = canvas.toDataURL('image/jpeg', 0.95);
            const imgHeight = halfWidth * (img.height / img.width);
            const yOffset = Math.max(20, (pageHeight - imgHeight) / 2);
            
            pdf.addImage(imageData, 'JPEG', halfWidth, yOffset, halfWidth, Math.min(imgHeight, pageHeight - 40));
            
            // Add page number on image side with better contrast
            pdf.setFontSize(12);
            pdf.setFillColor(255, 255, 255);  // White background
            pdf.rect(halfWidth + 10, 5, 25, 20, 'F');
            pdf.setTextColor(0, 0, 0);  // Black text on white background
            pdf.text(`${currentPage.pageNumber}`, halfWidth + 15, 18);
          } catch (error) {
            console.warn(`Failed to load image for page ${currentPage.pageNumber}:`, error);
            // Add placeholder text on right side
            pdf.setFontSize(14);
            pdf.setTextColor(128, 128, 128);
            pdf.text('Image not available', halfWidth + 20, pageHeight / 2);
          }
        } else {
          // No image - just show a note on the right side
          pdf.setFontSize(14);
          pdf.setTextColor(200, 200, 200);
          pdf.text('(Page image will be generated)', halfWidth + 20, pageHeight / 2);
        }
      }

      // Save the PDF
      const fileName = `${story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_storybook.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF Generated!",
        description: `Your storybook "${story.title}" has been downloaded.`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error generating your PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={isGenerating}
      className={className}
      data-testid="button-export-pdf"
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Generating PDF...
        </>
      ) : (
        <>
          <FileText className="w-4 h-4 mr-2" />
          Export PDF
        </>
      )}
    </Button>
  );
}
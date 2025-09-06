import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Story } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

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
      if (story.coreImageUrl) {
        try {
          // Load and add the core image
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = story.coreImageUrl!;
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

      // Add story pages as spreads
      for (let i = 0; i < story.pages.length; i += 2) {
        pdf.addPage();
        
        const leftPage = story.pages[i];
        const rightPage = story.pages[i + 1];

        // Left side - text page
        if (leftPage) {
          pdf.setFontSize(16);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont(undefined, 'normal');
          
          // Add page number
          pdf.setFontSize(12);
          pdf.text(`${leftPage.pageNumber}`, 20, 20);
          
          // Add text with word wrapping
          pdf.setFontSize(14);
          const textLines = pdf.splitTextToSize(leftPage.text, halfWidth - 40);
          pdf.text(textLines, 20, 40);
        }

        // Right side - image page
        if (rightPage?.imageUrl) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = rightPage.imageUrl!;
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);

            const imageData = canvas.toDataURL('image/jpeg', 0.95);
            const imgHeight = halfWidth * (img.height / img.width);
            const yOffset = (pageHeight - imgHeight) / 2;
            
            pdf.addImage(imageData, 'JPEG', halfWidth, yOffset, halfWidth, imgHeight);
            
            // Add page number with better contrast
            pdf.setFontSize(12);
            pdf.setFillColor(255, 255, 255);  // White background
            pdf.rect(halfWidth + 10, 5, 25, 20, 'F');
            pdf.setTextColor(0, 0, 0);  // Black text on white background
            pdf.text(`${rightPage.pageNumber}`, halfWidth + 15, 18);
          } catch (error) {
            console.warn(`Failed to load image for page ${rightPage.pageNumber}:`, error);
            // Add placeholder text
            pdf.setFontSize(14);
            pdf.setTextColor(128, 128, 128);
            pdf.text('Image not available', halfWidth + 20, pageHeight / 2);
          }
        }
      }

      // Handle odd number of pages
      if (story.pages.length % 2 !== 0) {
        const lastPage = story.pages[story.pages.length - 1];
        if (lastPage && !lastPage.imageUrl) {
          // If last page has no image, put text on the right side instead
          pdf.setFontSize(14);
          pdf.setTextColor(0, 0, 0);
          const textLines = pdf.splitTextToSize(lastPage.text, halfWidth - 40);
          pdf.text(textLines, halfWidth + 20, 40);
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
          <FileDown className="w-4 h-4 mr-2" />
          Export PDF
        </>
      )}
    </Button>
  );
}
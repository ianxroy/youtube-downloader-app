
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Music, ArrowRight, Loader2, Download, Video, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import gsap from "gsap";
import { getYoutubeVideoInfo, downloadYoutubeVideo, YoutubeVideoInfo } from "@/ai/flows/youtube";
import { useToast } from "@/hooks/use-toast";

type Step = "idle" | "fetching" | "select" | "downloading" | "done";

export default function Home() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState("mp4");
  const [videoInfo, setVideoInfo] = useState<YoutubeVideoInfo | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null);

  const { toast } = useToast();
  const resultsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);

  const handleFetch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!url.trim()) return;
    setStep("fetching");
    try {
      const info = await getYoutubeVideoInfo({ url });
      setVideoInfo(info);
      setSelectedQuality(info.formats.mp4[0]?.qualityLabel || null);
      setStep("select");
    } catch (error) {
      console.error(error);
      toast({
        title: "Error fetching video",
        description: "Could not fetch video details. Please check the URL and try again.",
        variant: "destructive",
      });
      setStep("idle");
    }
  };
  
  const handleDownload = async () => {
    if (!videoInfo || !selectedFormat || (selectedFormat === 'mp4' && !selectedQuality)) {
        toast({
            title: "Selection required",
            description: "Please select a format and quality.",
            variant: "destructive",
        });
        return;
    }
    setStep("downloading");
    setProgress(0);
    try {
        const result = await downloadYoutubeVideo({ 
            url, 
            format: selectedFormat as 'mp4' | 'mp3',
            quality: selectedQuality 
        });
        setDownloadUrl(result.dataUri);
        setDownloadFilename(result.filename);
        setStep("done");
    } catch (error) {
        console.error(error);
        toast({
            title: "Download failed",
            description: "An error occurred during the download process. Please try again.",
            variant: "destructive",
        });
        setStep("select");
    }
  };

  const handleReset = () => {
    setUrl("");
    setStep("idle");
    setProgress(0);
    setSelectedFormat("mp4");
    setVideoInfo(null);
    setSelectedQuality(null);
    setDownloadUrl(null);
    setDownloadFilename(null);
  };

  useEffect(() => {
    if (step === "select" && resultsRef.current) {
      gsap.fromTo(resultsRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [step]);
  
  useEffect(() => {
    // Fake progress for downloading feel
    if (step === 'downloading') {
      gsap.fromTo(progressRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 });
      const timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) { // Stop at 95 to wait for actual download link
            clearInterval(timer);
            return 95;
          }
          return prev + 1;
        });
      }, 100);

      return () => clearInterval(timer);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'done' && downloadUrl && downloadLinkRef.current) {
        setProgress(100);
        downloadLinkRef.current.click();
    }
  }, [step, downloadUrl]);

  return (
    <div className="flex flex-col min-h-screen bg-background font-body">
      <header className="py-6 px-4 md:px-8 flex justify-between items-center">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary font-headline">
          <Music />
          <h1>HanBeats</h1>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="w-full max-w-2xl mx-auto overflow-hidden shadow-lg border-primary/20 bg-card">
              <CardHeader className="text-center p-6">
                <CardTitle className="text-3xl font-headline tracking-tight">YouTube Downloader</CardTitle>
                <CardDescription>Paste a YouTube link to download videos in MP4 or MP3 format.</CardDescription>
              </CardHeader>
              
              <CardContent className="p-6">
                {step === 'idle' && (
                  <form onSubmit={handleFetch} className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-grow text-base"
                      required
                      aria-label="YouTube URL"
                    />
                    <Button type="submit" size="lg" disabled={!url.trim()}>
                      Fetch Video <ArrowRight className="ml-2" />
                    </Button>
                  </form>
                )}

                {step === 'fetching' && (
                  <div className="flex justify-center items-center h-24">
                    <Loader2 className="animate-spin text-primary" size={48} />
                    <p className="ml-4 text-lg">Fetching video details...</p>
                  </div>
                )}
                
                {(step === 'select' || step === 'downloading' || step === 'done') && videoInfo && (
                  <div ref={resultsRef}>
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                       <div className="md:w-1/3 flex-shrink-0">
                        <Image
                          src={videoInfo.thumbnail}
                          alt="Video thumbnail"
                          width={1280}
                          height={720}
                          className="rounded-lg aspect-video object-cover shadow-md"
                          data-ai-hint="lofi anime"
                        />
                      </div>
                      <div className="md:w-2/3">
                        <h3 className="text-xl font-semibold leading-tight">{videoInfo.title}</h3>
                        <p className="text-muted-foreground mt-1">Duration: {videoInfo.duration}</p>
                      </div>
                    </div>
                    
                    <Separator className="my-6" />

                    <Tabs value={selectedFormat} onValueChange={setSelectedFormat} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="mp4"><Video className="mr-2"/>MP4</TabsTrigger>
                        <TabsTrigger value="mp3"><AudioLines className="mr-2"/>MP3</TabsTrigger>
                      </TabsList>
                      <TabsContent value="mp4" className="mt-4">
                        <Label>Select Quality:</Label>
                        <RadioGroup value={selectedQuality || ''} onValueChange={setSelectedQuality} className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                          {videoInfo.formats.mp4.map(q => (
                             <div key={q.itag}>
                               <RadioGroupItem value={q.qualityLabel} id={`q-${q.itag}`} className="peer sr-only" />
                               <Label htmlFor={`q-${q.itag}`} className="cursor-pointer flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                 {q.qualityLabel}
                               </Label>
                             </div>
                          ))}
                        </RadioGroup>
                      </TabsContent>
                      <TabsContent value="mp3" className="mt-4 text-center p-4 bg-muted/50 rounded-md">
                        <p className="text-muted-foreground">Download as high-quality MP3 audio.</p>
                      </TabsContent>
                    </Tabs>

                    <div className="mt-6 text-center" ref={progressRef}>
                      {step === 'select' && (
                         <Button onClick={handleDownload} size="lg" className="w-full md:w-auto transition-all duration-300 transform hover:scale-105" disabled={selectedFormat === 'mp4' && !selectedQuality}>
                            <Download className="mr-2" /> Start Download
                         </Button>
                      )}
                      {step === 'downloading' && (
                        <div className="w-full space-y-2">
                          <Progress value={progress} className="w-full h-4" />
                          <p className="text-sm text-muted-foreground">{`Converting... ${progress}%`}</p>
                        </div>
                      )}
                      {step === 'done' && (
                         <div className="flex flex-col items-center gap-4">
                          <p className="text-xl font-bold text-foreground">Download Ready!</p>
                           <a ref={downloadLinkRef} href={downloadUrl!} download={downloadFilename!} className="hidden">Download</a>
                           <Button onClick={handleReset} size="lg" variant="outline" className="w-full md:w-auto">
                             Download Another Video
                           </Button>
                         </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="lg:col-span-1">
             <div className="sticky top-24">
              <Card className="border-dashed border-primary/50">
                <CardHeader>
                  <CardTitle className="text-center text-muted-foreground font-normal text-sm tracking-widest">ADVERTISEMENT</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted aspect-square w-full rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground text-lg">Ad Space</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </main>
      
      <footer className="text-center p-6 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} HanBeats. All Rights Reserved.</p>
        <p className="mt-2">Disclaimer: Please respect copyright laws and the terms of service of YouTube.</p>
      </footer>
    </div>
  );
}

    
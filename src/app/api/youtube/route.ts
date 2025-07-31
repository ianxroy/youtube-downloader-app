import { NextResponse, type NextRequest } from 'next/server';
import ytdl from 'ytdl-core';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const YoutubeInputSchema = z.object({
  url: z.string().url().describe('The URL of the YouTube video.'),
});

const YoutubeVideoInfoSchema = z.object({
  title: z.string(),
  thumbnail: z.string(),
  duration: z.string(),
  formats: z.object({
    mp4: z.array(z.object({ itag: z.number(), qualityLabel: z.string() })),
    mp3: z.array(z.object({ itag: z.number(), audioBitrate: z.number() })),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = YoutubeInputSchema.parse(body);

    const info = await ytdl.getInfo(url);
    const mp4Formats = ytdl
      .filterFormats(info.formats, 'videoandaudio')
      .filter((f) => f.container === 'mp4' && f.qualityLabel)
      .map((format) => ({
        itag: format.itag,
        qualityLabel: format.qualityLabel,
      }));

    const mp3Formats = ytdl
      .filterFormats(info.formats, 'audioonly')
      .map((format) => ({
        itag: format.itag,
        audioBitrate: format.audioBitrate || 0,
      }));

    const duration = new Date(parseInt(info.videoDetails.lengthSeconds) * 1000)
      .toISOString()
      .substr(11, 8);

    const result = {
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
      duration,
      formats: {
        mp4: mp4Formats,
        mp3: mp3Formats,
      },
    };
    
    const validatedData = YoutubeVideoInfoSchema.parse(result);
    return NextResponse.json(validatedData);

  } catch (error) {
    console.error('Error fetching video info:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Could not fetch video details. Please check the URL and try again.' }, { status: 500 });
  }
}

const DownloadQuerySchema = z.object({
  url: z.string().url(),
  format: z.enum(['mp4', 'mp3']),
  quality: z.string(),
});

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const params = Object.fromEntries(searchParams.entries());

    try {
        const { url, format, quality } = DownloadQuerySchema.parse(params);
        
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9\s]/g, '');
        const filename = `${title}.${format}`;

        let filter: ytdl.Filter = format === 'mp3' ? 'audioonly' : 'videoandaudio';
        
        const stream = ytdl(url, {
            filter: filter,
            quality: quality,
        });

        const headers = new Headers();
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        const mimeType = format === 'mp4' ? 'video/mp4' : 'audio/mpeg';
        headers.set('Content-Type', mimeType);

        return new Response(stream as any, { headers });

    } catch (error) {
        console.error('Download failed:', error);
         if (error instanceof z.ZodError) {
            return NextResponse.json({ message: 'Invalid download parameters.' }, { status: 400 });
        }
        return NextResponse.json({ message: 'An error occurred during the download process. Please try again.' }, { status: 500 });
    }
}

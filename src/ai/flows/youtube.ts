
'use server';
/**
 * @fileOverview A Genkit flow for interacting with YouTube.
 *
 * - getYoutubeVideoInfo - A function that returns metadata for a YouTube video.
 * - downloadYoutubeVideo - A function that downloads a YouTube video as MP4 or MP3.
 * - YoutubeVideoInfo - The return type for the getYoutubeVideoInfo function.
 * - DownloadYoutubeVideoInput - The input type for the downloadYoutubeVideo function.
 * - DownloadYoutubeVideoOutput - The return type for the downloadYoutubeVideo function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import ytdl from 'ytdl-core';

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
export type YoutubeVideoInfo = z.infer<typeof YoutubeVideoInfoSchema>;

export async function getYoutubeVideoInfo(
  input: z.infer<typeof YoutubeInputSchema>
): Promise<YoutubeVideoInfo> {
  return getYoutubeVideoInfoFlow(input);
}

const getYoutubeVideoInfoFlow = ai.defineFlow(
  {
    name: 'getYoutubeVideoInfoFlow',
    inputSchema: YoutubeInputSchema,
    outputSchema: YoutubeVideoInfoSchema,
  },
  async ({ url }) => {
    const info = await ytdl.getInfo(url);
    const mp4Formats = ytdl
      .filterFormats(info.formats, 'videoandaudio')
      .filter((f) => f.container === 'mp4')
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

    return {
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
      duration,
      formats: {
        mp4: mp4Formats,
        mp3: mp3Formats,
      },
    };
  }
);

export const DownloadYoutubeVideoInputSchema = z.object({
  url: z.string().url(),
  format: z.enum(['mp4', 'mp3']),
  quality: z.string().nullable(),
});
export type DownloadYoutubeVideoInput = z.infer<typeof DownloadYoutubeVideoInputSchema>;

export const DownloadYoutubeVideoOutputSchema = z.object({
  dataUri: z.string(),
  filename: z.string(),
});
export type DownloadYoutubeVideoOutput = z.infer<typeof DownloadYoutubeVideoOutputSchema>;

export async function downloadYoutubeVideo(
  input: DownloadYoutubeVideoInput
): Promise<DownloadYoutubeVideoOutput> {
  return downloadYoutubeVideoFlow(input);
}

const downloadYoutubeVideoFlow = ai.defineFlow(
  {
    name: 'downloadYoutubeVideoFlow',
    inputSchema: DownloadYoutubeVideoInputSchema,
    outputSchema: DownloadYoutubeVideoOutputSchema,
  },
  async ({ url, format, quality }) => {
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^a-zA-Z0-9\s]/g, '');

    let filter: ytdl.Filter = 'videoandaudio';
    if (format === 'mp3') {
        filter = 'audioonly';
    }

    const stream = ytdl(url, {
        filter: filter,
        quality: quality || (format === 'mp4' ? 'highestvideo' : 'highestaudio'),
    });

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    const mimeType = format === 'mp4' ? 'video/mp4' : 'audio/mpeg';
    const filename = `${title}.${format}`;

    return {
      dataUri: `data:${mimeType};base64,${buffer.toString('base64')}`,
      filename: filename,
    };
  }
);

    
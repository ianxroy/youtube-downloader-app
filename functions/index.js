const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const ytdlCore = require("ytdl-core");

const app = express();
app.use(cors({ origin: true }));


app.post("/youtube", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !ytdl.validateURL(url)) {
      return res.status(400).send({ message: "Invalid or missing YouTube URL." });
    }
    
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

    res.json(result);

  } catch (error) {
    console.error('Error fetching video info:', error);
    res.status(500).send({ message: 'Could not fetch video details. Please check the URL and try again.' });
  }
});


app.get("/download", async (req, res) => {
  try {
    const { url, format, quality } = req.query;

    if (!url || !ytdlCore.validateURL(url)) {
      return res.status(400).send("Invalid YouTube URL provided.");
    }
    
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^a-zA-Z0-9\s]/g, '');
    const filename = `${title}.${format}`;

    let filter = format === 'mp3' ? 'audioonly' : 'videoandaudio';
    
    res.header("Content-Disposition", `attachment; filename="${filename}"`);
    const mimeType = format === 'mp4' ? 'video/mp4' : 'audio/mpeg';
    res.header('Content-Type', mimeType);

    ytdl(url, {
        filter: filter,
        quality: quality,
    }).pipe(res);

  } catch(err) {
    console.error("Failed to download video: ", err);
    res.status(500).send("An error occurred during the download process.");
  }
});

exports.api = functions.https.onRequest(app);

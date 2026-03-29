const express = require('express');
const cors = require('cors');
const ytDlp = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// â”€â”€â”€ Helper: طھظ†ط³ظٹظ‚ ط§ظ„ط£ط±ظ‚ط§ظ… â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatNum(n) {
  if (!n) return '0';
  n = parseInt(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// â”€â”€â”€ Helper: طھظ†ط³ظٹظ‚ ط§ظ„ظ…ط¯ط© â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// â”€â”€â”€ Route: ط§ظ„طµظپط­ط© ط§ظ„ط±ط¦ظٹط³ظٹط© â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SaveZone TikTok API âœ…' });
});

// â”€â”€â”€ Route: ط¬ظ„ط¨ ط¨ظٹط§ظ†ط§طھ ط§ظ„ظپظٹط¯ظٹظˆ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/info', async (req, res) => {
  const url = (req.query.url || '').trim();

  if (!url) {
    return res.status(400).json({ error: 'ط£ط±ط³ظ„ ط±ط§ط¨ط· ط§ظ„ظپظٹط¯ظٹظˆ ط¹ط¨ط± ?url=' });
  }

  if (!url.includes('tiktok.com')) {
    return res.status(400).json({ error: 'ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط§ظ„ط±ط§ط¨ط· ظ…ظ† TikTok' });
  }

  try {
    const output = await ytDlp(url, {
      dumpSingleJson:      true,
      noWarnings:          true,
      noCheckCertificates: true,
      preferFreeFormats:   true,
    });

    // â”€â”€ ط§ط®طھظٹط§ط± ط£ظپط¶ظ„ ط±ط§ط¨ط· ظپظٹط¯ظٹظˆ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const formats = output.formats || [];
    let videoUrl = null;
    let videoHD  = null;

    for (const f of [...formats].reverse()) {
      if (f.ext === 'mp4' && f.url) {
        if (!videoUrl) videoUrl = f.url;
        if ((f.height || 0) >= 720 && !videoHD) videoHD = f.url;
      }
    }

    videoUrl = videoUrl || output.url || '';
    videoHD  = videoHD  || videoUrl;

    const data = {
      title:         output.title        || output.description || 'ط¨ط¯ظˆظ† ظˆطµظپ',
      thumbnail:     output.thumbnail    || '',
      author:        output.uploader     || output.creator     || 'Unknown',
      author_id:     output.uploader_id  || '',
      duration:      formatDuration(output.duration),
      duration_sec:  output.duration     || 0,
      like_count:    formatNum(output.like_count),
      comment_count: formatNum(output.comment_count),
      view_count:    formatNum(output.view_count),
      share_count:   formatNum(output.repost_count),
      video_url:     videoUrl,
      video_hd:      videoHD,
      webpage_url:   output.webpage_url  || url,
    };

    return res.json({ success: true, data });

  } catch (err) {
    console.error('yt-dlp error:', err.message);
    return res.status(422).json({
      error: 'طھط¹ط°ظ‘ط± ط¬ظ„ط¨ ط§ظ„ظپظٹط¯ظٹظˆ. طھط£ظƒط¯ ظ…ظ† طµط­ط© ط§ظ„ط±ط§ط¨ط·.',
      detail: err.message?.slice(0, 200),
    });
  }
});

// â”€â”€â”€ Route: طھط­ظ…ظٹظ„ ط§ظ„ظپظٹط¯ظٹظˆ ط¹ط¨ط± Proxy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/download', async (req, res) => {
  const videoUrl = (req.query.url || '').trim();
  const type     = (req.query.type || 'mp4').trim();

  if (!videoUrl) return res.status(400).json({ error: 'ط£ط±ط³ظ„ ط±ط§ط¨ط· ط§ظ„ظپظٹط¯ظٹظˆ' });

  try {
    const https    = require('https');
    const http     = require('http');
    const parsed   = new URL(videoUrl);
    const lib      = parsed.protocol === 'https:' ? https : http;
    const filename = `tiktok_savezone.${type === 'mp3' ? 'mp3' : 'mp4'}`;
    const mime     = type === 'mp3' ? 'audio/mpeg' : 'video/mp4';

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mime);

    lib.get(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
      }
    }, (proxyRes) => {
      if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
        const loc = proxyRes.headers.location;
        return res.redirect('/download?url=' + encodeURIComponent(loc) + '&type=' + type);
      }
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      proxyRes.pipe(res);
    }).on('error', (e) => {
      if (!res.headersSent) res.status(500).json({ error: 'ظپط´ظ„ ط§ظ„طھط­ظ…ظٹظ„: ' + e.message });
    });

  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SaveZone API running on port ${PORT}`);
});

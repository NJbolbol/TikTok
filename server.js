const express = require('express');
const cors = require('cors');
const ytDlp = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Helper: تنسيق الأرقام ───────────────────────────────
function formatNum(n) {
  if (!n) return '0';
  n = parseInt(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// ─── Helper: تنسيق المدة ─────────────────────────────────
function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Route: الصفحة الرئيسية ──────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SaveZone TikTok API ✅' });
});

// ─── Route: جلب بيانات الفيديو ───────────────────────────
app.get('/info', async (req, res) => {
  const url = (req.query.url || '').trim();

  if (!url) {
    return res.status(400).json({ error: 'أرسل رابط الفيديو عبر ?url=' });
  }

  if (!url.includes('tiktok.com')) {
    return res.status(400).json({ error: 'يجب أن يكون الرابط من TikTok' });
  }

  try {
    const output = await ytDlp(url, {
      dumpSingleJson:      true,
      noWarnings:          true,
      noCheckCertificates: true,
      preferFreeFormats:   true,
    });

    // ── اختيار أفضل رابط فيديو ──────────────────────────
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
      title:         output.title        || output.description || 'بدون وصف',
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
      error: 'تعذّر جلب الفيديو. تأكد من صحة الرابط.',
      detail: err.message?.slice(0, 200),
    });
  }
});

app.listen(PORT, () => {
  console.log(`SaveZone API running on port ${PORT}`);
});

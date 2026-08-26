import {chromium} from '@playwright/test';

const browser = await chromium.launch({headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4173/', {waitUntil: 'domcontentloaded'}).catch(() => {});

const out = await page.evaluate(async () => {
  const res = {
    ua: navigator.userAgent,
    isSecureContext: window.isSecureContext,
    hasVideoEncoder: typeof window.VideoEncoder !== 'undefined',
    hasAudioEncoder: typeof window.AudioEncoder !== 'undefined',
    hasOpfs: typeof navigator.storage?.getDirectory === 'function',
    video: {},
    audio: {},
  };
  const vcfgs = {
    'avc1.42E01E 1080x1920': {codec: 'avc1.42E01E', width: 1080, height: 1920, framerate: 30},
    'avc1.640028 1080x1920': {codec: 'avc1.640028', width: 1080, height: 1920, framerate: 30},
    'avc1.42E01E 640x480': {codec: 'avc1.42E01E', width: 640, height: 480, framerate: 30},
    'vp8 1080x1920': {codec: 'vp8', width: 1080, height: 1920, framerate: 30},
    'vp09.00.10.08 1080x1920': {codec: 'vp09.00.10.08', width: 1080, height: 1920, framerate: 30},
  };
  for (const [k, cfg] of Object.entries(vcfgs)) {
    try {
      const r = await window.VideoEncoder.isConfigSupported(cfg);
      res.video[k] = r.supported === true;
    } catch (e) { res.video[k] = 'error: ' + e.message; }
  }
  for (const [k, cfg] of Object.entries({
    'mp4a.40.2': {codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000},
    'opus': {codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000},
  })) {
    try {
      const r = await window.AudioEncoder.isConfigSupported(cfg);
      res.audio[k] = r.supported === true;
    } catch (e) { res.audio[k] = 'error: ' + e.message; }
  }
  return res;
});

console.log(JSON.stringify(out, null, 2));
await browser.close();

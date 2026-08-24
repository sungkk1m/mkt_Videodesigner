import {chromium} from '@playwright/test';
const browser = await chromium.launch({headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4173/', {waitUntil: 'domcontentloaded'});
const out = await page.evaluate(async () => {
  const res = {};
  for (const [k, cfg] of Object.entries({
    'avc1.42E01E decode': {codec: 'avc1.42E01E', codedWidth: 1920, codedHeight: 1080},
    'avc1.640028 decode': {codec: 'avc1.640028', codedWidth: 1920, codedHeight: 1080},
    'vp8 decode': {codec: 'vp8', codedWidth: 1920, codedHeight: 1080},
    'vp09.00.10.08 decode': {codec: 'vp09.00.10.08', codedWidth: 1920, codedHeight: 1080},
  })) {
    try { res[k] = (await window.VideoDecoder.isConfigSupported(cfg)).supported === true; }
    catch (e) { res[k] = 'error: ' + e.message; }
  }
  try { res['aac decode'] = (await window.AudioDecoder.isConfigSupported({codec:'mp4a.40.2', sampleRate:48000, numberOfChannels:2})).supported === true; }
  catch (e) { res['aac decode'] = 'error: ' + e.message; }
  return res;
});
console.log(JSON.stringify(out, null, 2));
await browser.close();

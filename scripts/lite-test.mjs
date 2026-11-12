// Run against a lite dev/preview server: URL=http://localhost:4178 node scripts/lite-test.mjs
// For slower public deployments, set LOAD_TIMEOUT_MS=60000; UI response checks stay at 2 seconds.
// Uses real browser autoplay policy, media decoding, storage and network requests.
import puppeteer from 'puppeteer-core';

const url = process.env.URL ?? 'http://localhost:4178/';
const loadTimeout = Number(process.env.LOAD_TIMEOUT_MS ?? 12000);
if (!Number.isFinite(loadTimeout) || loadTimeout <= 0) throw new Error('LOAD_TIMEOUT_MS must be a positive number');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const launch = (autoplay) => puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist',
    `--autoplay-policy=${autoplay ? 'no-user-gesture-required' : 'document-user-activation-required'}`,
    '--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});

async function open(browser, prefs, intercept, targetUrl = url) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.evaluateOnNewDocument((saved) => {
    if (saved) localStorage.setItem('se.music', JSON.stringify(saved));
    const OriginalAudio = window.Audio;
    window.__testAudio = [];
    window.Audio = new Proxy(OriginalAudio, {
      construct(target, args) {
        const audio = Reflect.construct(target, args);
        audio.__testPlaying = [];
        audio.addEventListener('playing', () => audio.__testPlaying.push(audio.currentTime));
        window.__testAudio.push(audio);
        return audio;
      },
    });
  }, prefs);
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const requests = new Map();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  cdp.on('Network.requestWillBeSent', ({ requestId, request }) => {
    requests.set(requestId, { url: request.url, method: request.method, bytes: 0 });
  });
  cdp.on('Network.responseReceived', ({ requestId, response }) => {
    const request = requests.get(requestId);
    if (request) request.status = response.status;
  });
  cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
    const request = requests.get(requestId);
    if (request) { request.bytes = encodedDataLength; request.done = true; }
  });
  cdp.on('Network.loadingFailed', ({ requestId, errorText }) => {
    const request = requests.get(requestId);
    if (request) request.error = errorText;
  });
  if (intercept) {
    await page.setRequestInterception(true);
    page.on('request', (request) => void intercept(request));
  }
  // Puppeteer's evaluate can confer a user gesture. CDP reads explicitly do not, so the
  // blocked-autoplay test cannot accidentally unlock playback just by inspecting it.
  const read = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: false });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async (condition, timeout = loadTimeout) => {
    const until = Date.now() + timeout;
    do {
      if (typeof condition === 'function' ? await condition() : await read(condition)) return true;
      await sleep(100);
    } while (Date.now() < until);
    return false;
  };
  const audioRequests = () => [...requests.values()].filter((request) => request.url.includes('/music/'));
  const state = () => read(`(() => {
    const a = window.__testAudio[0], m = window.se?.hud.music;
    return { on: m?.on, source: m?.source, track: m?.track, paused: a?.paused,
      src: a?.getAttribute('src'), time: a?.currentTime, volume: m?.volume,
      context: m?.ctx?.state, storedPosition: Number(sessionStorage.getItem('se.music.pos') || 0),
      firstPlayingTime: a?.__testPlaying[0], seeking: a?.seeking,
      seekable: a ? Array.from({ length: a.seekable.length }, (_, i) => [a.seekable.start(i), a.seekable.end(i)]) : [] };
  })()`);
  await page.goto(targetUrl, { waitUntil: 'load', timeout: loadTimeout });
  if (!await wait('!!window.se && !!se.hud.music.track')) {
    throw new Error(`Page initialization timed out after ${loadTimeout} ms: ${targetUrl}; ${errors.join('; ')}`);
  }
  return { page, cdp, context, read, wait, state, requests, errors, audioRequests };
}

const playing = '!!window.__testAudio[0] && !__testAudio[0].paused && __testAudio[0].currentTime > 0.1 && se.hud.music.ctx?.state === "running"';
const stopped = '!se.hud.music.on && __testAudio[0].paused && !__testAudio[0].hasAttribute("src")';
const makeLocalTrack = `(() => {
  const rate = 8000, samples = rate * 8, bytes = new ArrayBuffer(44 + samples * 2), v = new DataView(bytes);
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) v.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, samples * 2, true);
  return se.hud.music.setFile(new File([bytes], 'lite-test.wav', { type: 'audio/wav' }));
})()`;

let browser;
try {
  browser = await launch(true);
  const off = await open(browser, { on: false, volume: 0.3 });
  const firstTextureUrls = ['earth_color.jpg', 'earth_night.jpg', 'earth_clouds.jpg', 'earth_height.png',
    'moon_color.jpg', 'moon_height.png'].map((file) => new URL(`/textures/${file}`, url).href);
  await off.wait(() => firstTextureUrls.every((textureUrl) => [...off.requests.values()].some((request) =>
    request.url === textureUrl && (request.done || request.error || (request.status && request.status !== 200)))));
  let state = await off.state();
  check('saved-off restores preference and volume', state.on === false && state.volume === 0.3);
  check('saved-off makes no audio HEAD or GET', off.audioRequests().length === 0 && !state.src);
  const textures = [...off.requests.values()].filter((request) => request.url.includes('/textures/'));
  const textureBytes = textures.reduce((sum, request) => sum + request.bytes, 0);
  const texturesComplete = firstTextureUrls.every((textureUrl) => textures.some((request) => request.url === textureUrl))
    && textures.every((request) => request.done && request.status === 200 && !request.error);
  const textureProblems = firstTextureUrls.flatMap((textureUrl) => {
    const matches = textures.filter((request) => request.url === textureUrl);
    if (!matches.length) return [`${textureUrl}: not requested`];
    return matches.filter((request) => !request.done || request.status !== 200 || request.error)
      .map((request) => `${request.url}: ${request.error ?? (request.status ? `HTTP ${request.status}, ${request.done ? 'finished' : 'unfinished'}` : 'no response')}`);
  });
  check('first Earth/Moon textures finish successfully', texturesComplete, textureProblems.join('; '));
  check('first textures stay within 3.5 MB', texturesComplete && textureBytes > 0 && textureBytes <= 3_500_000,
    `${textureBytes} bytes${texturesComplete ? '' : ', incomplete transfer'}`);
  await off.page.mouse.click(700, 450);
  await sleep(300);
  check('ordinary interaction while off does not fetch music', off.audioRequests().length === 0);

  await off.page.keyboard.press('KeyM');
  check('M starts real media playback', await off.wait(playing));
  await off.read(`(() => {
    const audio = __testAudio[0];
    audio.pause();
    window.__testSeeked = false;
    audio.addEventListener('seeked', () => { window.__testSeeked = true; }, { once: true });
    audio.currentTime = 20;
  })()`);
  const seekReady = await off.wait('window.__testSeeked && !__testAudio[0].seeking && Math.abs(__testAudio[0].currentTime - 20) < 0.25');
  check('paused audio seeks to 20 seconds before the resume test', seekReady, seekReady ? '' : JSON.stringify(await off.state()));
  if (!seekReady) throw new Error('Cannot test saved playback position because seeking to 20 seconds failed');
  await off.page.keyboard.press('KeyM');
  check('turning music off unloads its remote source', await off.wait(stopped));
  await off.read('window.dispatchEvent(new Event("pagehide"))');
  state = await off.state();
  check('pagehide preserves position after unloading', state.storedPosition >= 20, JSON.stringify(state));
  const savedPosition = state.storedPosition;
  const stoppedRequests = off.audioRequests().length;
  await sleep(700);
  check('stopped music does not restart downloading', off.audioRequests().length === stoppedRequests);

  await off.page.reload({ waitUntil: 'load', timeout: loadTimeout });
  if (!await off.wait('!!window.se && !!se.hud.music.track')) {
    throw new Error(`Page initialization after reload timed out after ${loadTimeout} ms: ${url}; ${off.errors.join('; ')}`);
  }
  await sleep(500);
  check('reload while off makes no new audio request', off.audioRequests().length === stoppedRequests);
  await off.page.keyboard.press('KeyM');
  const resumedPlaying = await off.wait(`${playing} && __testAudio[0].__testPlaying.length > 0`);
  const resumeState = await off.state();
  check('re-enable resumes the saved position', resumedPlaying && Math.abs(resumeState.firstPlayingTime - savedPosition) < 0.5,
    JSON.stringify({ savedPosition, ...resumeState }));
  await off.page.keyboard.press('KeyM');
  await off.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 128000, uploadThroughput: 128000 });
  await off.page.keyboard.press('KeyM');
  await off.page.keyboard.press('F4');
  check('settings remain interactive during slow audio loading', await off.wait('!document.querySelector(".dialog.settings").classList.contains("hidden")', 2000));
  await off.page.keyboard.press('Escape');
  await off.page.keyboard.press('KeyM');
  await off.page.keyboard.press('KeyM');
  await off.page.keyboard.press('KeyM');
  await sleep(800);
  check('rapid on/off under slow network stays stopped', await off.wait(stopped));
  await off.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  await off.read(makeLocalTrack);
  check('imported audio plays from the start', await off.wait(`${playing} && se.hud.music.source === 'file' && __testAudio[0].currentTime < 4`));
  await off.read('se.hud.music.clearFile()');
  check('removing an active local track plays the default track', await off.wait(`${playing} && se.hud.music.source === 'default' && __testAudio[0].currentTime < 4`));
  await off.read(makeLocalTrack);
  await off.wait(playing);
  await off.page.keyboard.press('KeyM');
  await off.wait(stopped);
  const beforeRemove = off.audioRequests().length;
  await off.read('se.hud.music.clearFile()');
  await sleep(500);
  check('removing a local track while off does not fetch default music', off.audioRequests().length === beforeRemove && (await off.state()).on === false);
  check('no page errors in music lifecycle', off.errors.length === 0, off.errors.join('; '));
  await off.context.close();

  const allowed = await open(browser);
  check('fresh visit autoplays when browser policy allows it', await allowed.wait(playing));
  check('fresh visit starts music without a user gesture', await allowed.read('!navigator.userActivation.hasBeenActive'));
  await allowed.context.close();

  if (process.env.HD_URL) {
    const hd = await open(browser, undefined, undefined, process.env.HD_URL);
    check('HD still autoplays under an allowed browser policy', await hd.wait(playing));
    await hd.context.close();
    const hdOff = await open(browser, { on: false, volume: 0.4 }, undefined, process.env.HD_URL);
    const hdState = await hdOff.state();
    check('HD still restores its closed preference and volume', !hdState.on && hdState.paused && hdState.volume === 0.4);
    await hdOff.page.keyboard.press('KeyM');
    check('HD still starts music when re-enabled', await hdOff.wait(playing));
    await hdOff.context.close();
  }

  let failAudio = true;
  const failed = await open(browser, undefined, async (request) => {
    if (failAudio && request.url().includes('/music/')) await request.respond({ status: 404, contentType: 'audio/mpeg', body: '' });
    else await request.continue();
  });
  check('failed audio stops without keeping a remote source attached', await failed.wait('__testAudio[0].paused && !__testAudio[0].hasAttribute("src")'));
  failAudio = false;
  if ((await failed.state()).on) await failed.page.keyboard.press('KeyM');
  await failed.page.keyboard.press('KeyM');
  check('failed audio can be retried', await failed.wait(playing));
  check('no page errors after failed audio retry', failed.errors.length === 0, failed.errors.join('; '));
  await failed.context.close();
  await browser.close();

  browser = await launch(false);
  const blocked = await open(browser);
  check('blocked autoplay unloads media but retains the on preference', await blocked.wait('se.hud.music.on && __testAudio[0].paused && !__testAudio[0].hasAttribute("src") && document.querySelector(".toast").textContent.includes("Click")'));
  check('blocked-autoplay inspection did not activate the page', await blocked.read('!navigator.userActivation.hasBeenActive'));
  const blockedRequests = blocked.audioRequests().length;
  await sleep(1000);
  check('blocked autoplay waits instead of repeatedly fetching', blocked.audioRequests().length === blockedRequests);
  await blocked.page.keyboard.press('KeyW');
  const resumed = await blocked.wait(playing);
  check('first ordinary key automatically starts blocked music', resumed, resumed ? '' : JSON.stringify(await blocked.state()));
  check('no page errors in blocked autoplay', blocked.errors.length === 0, blocked.errors.join('; '));
  await blocked.context.close();
} finally {
  await browser?.close();
}
console.log(`\n${failures ? `${failures} failed` : 'All lite loading checks passed'}`);
process.exitCode = failures ? 1 : 0;

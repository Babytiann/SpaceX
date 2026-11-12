/**
 * Background music from a file the player supplies: picked in Settings or dropped on the
 * window, kept in IndexedDB across reloads. Without one, the soundtrack the project ships at
 * public/music/soundtrack.mp3 is used. Playback is attempted on entry; if the browser refuses,
 * the first click or key press retries. The lightweight build only attaches media while wanted.
 */

const DEFAULT_URL = `${import.meta.env.BASE_URL}music/soundtrack.mp3`;
const PREFS_KEY = 'se.music';
const DB_NAME = 'space-engine';
const STORE = 'music';
/** Session storage key: playback position across reloads. */
const POS_KEY = 'se.music.pos';
const TRACK_KEY = 'track';
const FADE_S = 1.2;
/** Gain while the autopilot jumps, relative to the volume setting. */
const DUCK = 0.55;

interface StoredTrack { name: string; blob: Blob }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbRequest<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export class MusicPlayer {
  /** User preference: play when a track is available. */
  on = true;
  /** 0..1 */
  volume = 0.4;
  /** Name of the current track, or null when there is none. */
  track: string | null = null;
  /** 'file' for a picked or dropped file, 'default' for public/music/soundtrack.mp3. */
  source: 'file' | 'default' | null = null;
  /** Called whenever the state above changes (Settings re-renders from it). */
  onChange: () => void = () => {};

  private readonly audio = new Audio();
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private url: string | null = null;
  private unlocked = false;
  private autoplayRefused = false;
  private autoplayNoticeShown = false;
  /** Selection is kept independently of the media element, which can release its network request. */
  private selectedSrc: Blob | string | null = null;
  private sourceRevision = 0;
  private playbackRevision = 0;
  /** Keep quick file replacements/removals in their original order in IndexedDB too. */
  private storageWrites: Promise<void> = Promise.resolve();
  /** Where the track was when the page was last left (s). */
  private resumeAt = 0;
  private ducked = false;
  private pauseTimer = 0;

  private readonly unlock = () => {
    this.unlocked = true;
    if (!__LITE_BUILD__) {
      window.removeEventListener('pointerdown', this.unlock, true);
      window.removeEventListener('keydown', this.unlock, true);
    }
    this.update();
  };

  constructor(private readonly notify: (msg: string) => void) {
    this.audio.loop = true;
    this.audio.preload = __LITE_BUILD__ ? 'none' : 'auto';
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { on?: boolean; volume?: number };
      if (typeof p.on === 'boolean') this.on = p.on;
      if (typeof p.volume === 'number') this.volume = Math.min(Math.max(p.volume, 0), 1);
    } catch { /* no saved preferences */ }

    window.addEventListener('pointerdown', this.unlock, true);
    window.addEventListener('keydown', this.unlock, true);
    // A reload (a code change during development, or F5) starts again where the track was.
    try { this.resumeAt = Number(sessionStorage.getItem(POS_KEY) ?? 0) || 0; } catch { /* no session storage */ }
    window.addEventListener('pagehide', () => {
      const position = this.audio.currentTime || (__LITE_BUILD__ ? this.resumeAt : 0);
      try { sessionStorage.setItem(POS_KEY, String(position)); } catch { /* not remembered */ }
    });
    if (__LITE_BUILD__) {
      this.audio.addEventListener('loadedmetadata', () => {
        if (this.resumeAt <= 0 || !this.on || !this.audio.getAttribute('src')) return;
        try {
          const duration = this.audio.duration;
          this.audio.currentTime = Number.isFinite(duration) && duration > 0 ? this.resumeAt % duration : this.resumeAt;
          this.resumeAt = 0;
        } catch { /* keep the position for the next attempt */ }
      });
      this.audio.addEventListener('error', () => {
        if (this.on && this.audio.getAttribute('src') && this.audio.error) this.playbackFailed();
      });
    }

    // Drop an audio file anywhere on the window to use it as the soundtrack.
    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      const f = e.dataTransfer?.files[0];
      if (!f) return;
      e.preventDefault();
      if (!f.type.startsWith('audio/')) { this.notify('Drop an audio file to use it as music'); return; }
      void this.setFile(f);
    });

    void this.load();
  }

  get playing(): boolean {
    return !this.audio.paused;
  }

  /** M: music on or off. */
  toggle(): void {
    this.on = !this.on;
    if (__LITE_BUILD__ && this.on) this.autoplayRefused = false;
    this.save();
    if (!this.track) this.notify(this.on ? 'Music on (no track: choose one in Settings, F4)' : 'Music off');
    else this.notify(`Music ${this.on ? 'on' : 'off'}`);
    this.update();
  }

  setVolume(v: number): void {
    this.volume = Math.min(Math.max(v, 0), 1);
    this.save();
    if (this.on) this.ramp(0.15);
    this.onChange();
  }

  /** Lower the music a little while the autopilot jumps. */
  duck(on: boolean): void {
    if (on === this.ducked) return;
    this.ducked = on;
    if (this.on) this.ramp(0.8);
  }

  async setFile(file: File): Promise<void> {
    if (__LITE_BUILD__) {
      // Start from the user's gesture; a slow database write must not delay playback or win a later toggle.
      this.use(file, file.name, 'file');
      this.resumeAt = 0;
      this.autoplayRefused = false;
      this.on = true;
      this.save();
      this.notify(`Music: ${file.name}`);
      this.update();
      this.storageWrites = this.storageWrites.then(async () => {
        await dbRequest('readwrite', (s) => s.put({ name: file.name, blob: file } satisfies StoredTrack, TRACK_KEY));
      }).catch(() => { /* storage blocked: plays this session only */ });
      await this.storageWrites;
      return;
    }
    try {
      await dbRequest('readwrite', (s) => s.put({ name: file.name, blob: file } satisfies StoredTrack, TRACK_KEY));
    } catch { /* storage blocked: plays this session only */ }
    this.use(file, file.name, 'file');
    this.on = true;
    this.save();
    this.notify(`Music: ${file.name}`);
    this.update();
  }

  /** Forget the picked file; falls back to the project soundtrack if there is one. */
  async clearFile(): Promise<void> {
    if (__LITE_BUILD__) {
      this.use(DEFAULT_URL, 'soundtrack.mp3', 'default');
      this.resumeAt = 0;
      this.autoplayRefused = false;
      this.update();
      this.storageWrites = this.storageWrites.then(async () => {
        await dbRequest('readwrite', (s) => s.delete(TRACK_KEY));
      }).catch(() => { /* nothing stored */ });
      await this.storageWrites;
      return;
    }
    try { await dbRequest('readwrite', (s) => s.delete(TRACK_KEY)); } catch { /* nothing stored */ }
    this.stopNow();
    this.use(null, null, null);
    await this.loadDefault();
    this.update();
  }

  private async load(): Promise<void> {
    const revision = this.sourceRevision;
    try {
      const t = await dbRequest<StoredTrack | undefined>('readonly', (s) => s.get(TRACK_KEY));
      if (__LITE_BUILD__ && revision !== this.sourceRevision) return;
      if (t?.blob) { this.use(t.blob, t.name, 'file'); this.update(); return; }
    } catch { /* no IndexedDB */ }
    if (__LITE_BUILD__ && revision !== this.sourceRevision) return;
    await this.loadDefault();
    this.update();
  }

  private async loadDefault(): Promise<void> {
    if (__LITE_BUILD__) {
      // This is a shipped asset: select it without a HEAD or media request while music is off.
      this.use(DEFAULT_URL, 'soundtrack.mp3', 'default');
      return;
    }
    try {
      // The dev server answers a missing file with index.html, so check what came back.
      const r = await fetch(DEFAULT_URL, { method: 'HEAD' });
      if (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/')) {
        this.use(DEFAULT_URL, 'soundtrack.mp3', 'default');
      }
    } catch { /* offline or absent */ }
  }

  private use(src: Blob | string | null, name: string | null, source: MusicPlayer['source']): void {
    if (__LITE_BUILD__) {
      this.sourceRevision++;
      this.unload();
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = null;
      this.selectedSrc = src;
      this.track = name;
      this.source = source;
      this.onChange();
      return;
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = src instanceof Blob ? URL.createObjectURL(src) : null;
    const wasPlaying = this.playing;
    if (wasPlaying) this.audio.pause();
    this.audio.src = src instanceof Blob ? this.url! : src ?? '';
    if (!src) this.audio.removeAttribute('src');
    this.track = name;
    this.source = source;
    this.onChange();
  }

  /** Start or stop to match the preference, the track and the autoplay unlock. */
  private update(): void {
    this.onChange();
    // Before any click or key, try anyway: browsers allow it on a page the player has used before. If
    // that's refused, say how to start it and wait for the first click or key.
    const want = this.on && !!this.track && (this.unlocked || !this.autoplayRefused);
    if (want) this.start();
    else if (__LITE_BUILD__) this.unload();
    else this.fadeOut();
  }

  private start(): void {
    clearTimeout(this.pauseTimer);
    if (__LITE_BUILD__ && !this.audio.getAttribute('src')) {
      if (!this.on || !this.selectedSrc) return;
      if (this.selectedSrc instanceof Blob) this.url ??= URL.createObjectURL(this.selectedSrc);
      this.audio.src = this.selectedSrc instanceof Blob ? this.url! : this.selectedSrc;
    }
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0;
        this.ctx.createMediaElementSource(this.audio).connect(this.gain).connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        this.gain = null;
      }
    }
    // resume() can settle after play(), even inside an accepted input gesture. Only wait after
    // a gesture: on entry a suspended context may leave resume() pending until the user interacts.
    const waitForContext = __LITE_BUILD__ && this.unlocked;
    const resumed = this.ctx?.resume().catch(() => { /* state below decides whether playback is usable */ });
    if (this.audio.paused) {
      const revision = ++this.playbackRevision;
      if (!__LITE_BUILD__ && this.resumeAt > 0 && this.audio.currentTime === 0) {
        try { this.audio.currentTime = this.resumeAt; } catch { /* not seekable yet */ }
        this.resumeAt = 0;
      }
      this.audio.play().then(async () => {
        if (__LITE_BUILD__) {
          if (waitForContext) await resumed;
          if (revision !== this.playbackRevision || !this.on) return;
          if (this.ctx && this.ctx.state !== 'running') {
            this.refuseAutoplay();
            return;
          }
          this.unlocked = true;
          window.removeEventListener('pointerdown', this.unlock, true);
          window.removeEventListener('keydown', this.unlock, true);
          this.onChange();
          return;
        }
        // (Playing into an audio context the browser keeps suspended is still silence.)
        if (!this.ctx || this.ctx.state === 'running') this.unlocked = true;
        else if (!this.unlocked && !this.autoplayRefused) {
          this.autoplayRefused = true;
          this.notify('Click or press any key to start the music (M turns it off)');
        }
        this.onChange();
      }, (e: unknown) => {
        if (__LITE_BUILD__) {
          // pause/load rejects old play promises; they cannot revive or report errors for a newer intent.
          if (revision !== this.playbackRevision || !this.on) return;
          if (e instanceof DOMException && e.name === 'NotAllowedError') this.refuseAutoplay();
          else this.playbackFailed();
          return;
        }
        if (!this.unlocked && e instanceof DOMException && e.name === 'NotAllowedError') {
          this.autoplayRefused = true;
          this.notify('Click or press any key to start the music (M turns it off)');
        } else {
          this.notify('Could not play the music file');
        }
      });
    }
    this.ramp(FADE_S);
  }

  /** Pause alone allows the browser to keep buffering; detach to cancel its media request. */
  private unload(): void {
    this.playbackRevision++;
    clearTimeout(this.pauseTimer);
    if (this.audio.currentTime > 0) this.resumeAt = this.audio.currentTime;
    this.audio.pause();
    if (this.audio.getAttribute('src')) {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  private refuseAutoplay(): void {
    this.autoplayRefused = true;
    this.unlocked = false;
    this.unload();
    // A later source can be refused even after an earlier one played; allow a fresh gesture to retry.
    window.addEventListener('pointerdown', this.unlock, true);
    window.addEventListener('keydown', this.unlock, true);
    if (!this.autoplayNoticeShown) {
      this.autoplayNoticeShown = true;
      this.notify('Click or press any key to start the music (M turns it off)');
    }
    this.onChange();
  }

  private playbackFailed(): void {
    this.on = false;
    this.unload();
    this.notify('Could not play the music file; turn music on to retry');
    this.onChange();
  }

  private fadeOut(): void {
    if (this.audio.paused) return;
    this.ramp(FADE_S, 0);
    clearTimeout(this.pauseTimer);
    this.pauseTimer = window.setTimeout(() => { this.audio.pause(); this.onChange(); }, FADE_S * 1000 + 50);
  }

  private stopNow(): void {
    clearTimeout(this.pauseTimer);
    this.audio.pause();
  }

  private ramp(seconds: number, to = this.volume * (this.ducked ? DUCK : 1)): void {
    if (this.gain && this.ctx) {
      const g = this.gain.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(to, now + seconds);
    } else {
      // No Web Audio: jump straight to the level.
      this.audio.volume = to;
    }
  }

  private save(): void {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ on: this.on, volume: this.volume })); } catch { /* not remembered */ }
  }
}

import { useEffect, useMemo, useRef } from 'react';

interface EmbeddedVideoPlayerProps {
  url: string;
  title: string;
  initialPositionSec: number;
  maxAllowedPositionSec?: number;
  playbackRate?: number;
  onProgress: (positionSec: number, durationSec: number) => void;
  onPause: () => void;
  onEnded: () => void;
  onError?: () => void;
}

interface YouTubePlayerInstance {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: { target: YouTubePlayerInstance }) => void;
        onStateChange: (event: { data: number }) => void;
        onError?: () => void;
      };
    },
  ) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeApiPromise: Promise<YouTubeNamespace> | null = null;
const SEEK_TOLERANCE_SEC = 2.5;

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youTubeApiPromise) return youTubeApiPromise;

  youTubeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT) resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return youTubeApiPromise;
}

function youtubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    const embedMatch = parsed.pathname.match(/\/embed\/([^/]+)/);
    return embedMatch?.[1] ?? parsed.searchParams.get('v');
  } catch {
    return null;
  }
}

function isVimeoUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes('vimeo.com');
  } catch {
    return false;
  }
}

function VimeoPlayer(props: EmbeddedVideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerId = useMemo(() => `bee-vimeo-${crypto.randomUUID()}`, []);
  const callbackRef = useRef(props);
  const maxAllowedPositionRef = useRef(Math.max(0, props.initialPositionSec));
  callbackRef.current = props;

  const source = useMemo(() => {
    const parsed = new URL(props.url);
    parsed.searchParams.set('api', '1');
    parsed.searchParams.set('player_id', playerId);
    parsed.searchParams.set('controls', '0');
    return parsed.toString();
  }, [playerId, props.url]);

  useEffect(() => {
    function send(method: string, value?: unknown) {
      iframeRef.current?.contentWindow?.postMessage({ method, value }, 'https://player.vimeo.com');
    }
    function handleMessage(event: MessageEvent) {
      if (event.origin !== 'https://player.vimeo.com' || event.source !== iframeRef.current?.contentWindow) return;
      let message = event.data;
      if (typeof message === 'string') {
        try { message = JSON.parse(message); } catch { return; }
      }
      if (message?.event === 'ready') {
        send('addEventListener', 'timeupdate');
        send('addEventListener', 'play');
        send('addEventListener', 'pause');
        send('addEventListener', 'ended');
        send('setPlaybackRate', props.playbackRate ?? 1);
        if (props.initialPositionSec > 0) send('setCurrentTime', props.initialPositionSec);
      } else if (message?.event === 'timeupdate') {
        const position = Number(message.data?.seconds ?? 0);
        const duration = Number(message.data?.duration ?? 0);
        const allowedPosition = Math.max(
          maxAllowedPositionRef.current,
          callbackRef.current.maxAllowedPositionSec ?? 0,
          callbackRef.current.initialPositionSec,
        );
        if (position > allowedPosition + SEEK_TOLERANCE_SEC) {
          send('setCurrentTime', allowedPosition);
          callbackRef.current.onProgress(allowedPosition, duration);
          return;
        }
        maxAllowedPositionRef.current = Math.max(maxAllowedPositionRef.current, position);
        callbackRef.current.onProgress(position, duration);
      } else if (message?.event === 'play') {
      } else if (message?.event === 'pause') {
        callbackRef.current.onPause();
      } else if (message?.event === 'ended') {
        callbackRef.current.onEnded();
      } else if (message?.event === 'error') {
        callbackRef.current.onError?.();
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [props.initialPositionSec]);

  return (
    <iframe
      ref={iframeRef}
      src={source}
      className="absolute inset-0 h-full w-full"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      title={props.title}
      onError={() => props.onError?.()}
    />
  );
}

function YouTubePlayer(props: EmbeddedVideoPlayerProps & { videoId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const callbackRef = useRef(props);
  const maxAllowedPositionRef = useRef(Math.max(0, props.initialPositionSec));
  callbackRef.current = props;

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayerInstance | null = null;
    let progressTimer: number | null = null;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      const playerHost = document.createElement('div');
      containerRef.current.replaceChildren(playerHost);
      player = new YT.Player(playerHost, {
        videoId: props.videoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
          controls: 0,
          disablekb: 1,
          start: Math.max(0, Math.floor(props.initialPositionSec)),
        },
        events: {
          onReady: ({ target }) => {
            playerRef.current = target;
            target.setPlaybackRate(props.playbackRate ?? 1);
            const resumeAt = callbackRef.current.initialPositionSec;
            if (resumeAt > 0) target.seekTo(resumeAt, true);
            progressTimer = window.setInterval(() => {
              const position = target.getCurrentTime();
              const duration = target.getDuration();
              if (Number.isFinite(position) && Number.isFinite(duration)) {
                const allowedPosition = Math.max(
                  maxAllowedPositionRef.current,
                  callbackRef.current.maxAllowedPositionSec ?? 0,
                  callbackRef.current.initialPositionSec,
                );
                if (position > allowedPosition + SEEK_TOLERANCE_SEC) {
                  target.seekTo(allowedPosition, false);
                  callbackRef.current.onProgress(allowedPosition, duration);
                  return;
                }
                maxAllowedPositionRef.current = Math.max(maxAllowedPositionRef.current, position);
                callbackRef.current.onProgress(position, duration);
              }
            }, 500);
          },
          onStateChange: ({ data }) => {
            if (data === 1) {
            }
            if (data === 0) {
              if (progressTimer !== null) {
                window.clearInterval(progressTimer);
                progressTimer = null;
              }
              callbackRef.current.onEnded();
            }
            if (data === 2) {
              callbackRef.current.onPause();
            }
          },
          onError: () => callbackRef.current.onError?.(),
        },
      });
    });

    return () => {
      cancelled = true;
      if (progressTimer !== null) window.clearInterval(progressTimer);
      playerRef.current = null;
      player?.destroy();
      containerRef.current?.replaceChildren();
    };
  }, [props.videoId]);

  useEffect(() => {
    if (props.initialPositionSec > 0) {
      playerRef.current?.seekTo(props.initialPositionSec, true);
    }
  }, [props.initialPositionSec]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" title={props.title} />;
}

export default function EmbeddedVideoPlayer(props: EmbeddedVideoPlayerProps) {
  const videoId = youtubeVideoId(props.url);
  if (videoId) return <YouTubePlayer {...props} videoId={videoId} />;
  if (isVimeoUrl(props.url)) return <VimeoPlayer {...props} />;
  return (
    <iframe
      src={props.url}
      className="absolute inset-0 h-full w-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title={props.title}
      onError={() => props.onError?.()}
    />
  );
}

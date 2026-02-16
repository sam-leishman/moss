# iOS Video Playback Bug

## Problem
Videos play fine on desktop (including mobile emulation in dev tools) but are stuck loading infinitely on iPhone (iOS 18.6.2, Chrome app / WebKit).

## What Works on iOS
- Navigating directly to the video API URL (`/api/media/91/file`) — video plays fine
- A plain `<video controls playsinline preload="metadata" src="...">` element on a static HTML page (`/test-video.html`)
- Custom play via `onclick` on a container div (no native controls)
- `pointer-events: none` overlays on top of the video
- Re-setting the `src` attribute after a delay
- Full-screen modal (`position:fixed; inset:0; z-50`) with the same CSS structure as the app
- Dynamically setting `src` on modal open
- A raw `<video>` element written directly in `MediaDetailModal.svelte` (the Svelte parent component) using `src={videoSrc}`

## What Does NOT Work on iOS
- The `<video>` element when rendered inside the `VideoPlayer.svelte` child component — even when stripped to the absolute bare minimum (just `<video bind:this={videoEl} {src} playsinline controls preload="metadata">`)

## Key Facts
1. **Not a server/backend issue.** Direct URL plays fine. Server correctly handles Range requests (206 with proper headers). Cookies are present.
2. **Not a reverse proxy issue.** Fails the same way on direct LAN connection to the dev server.
3. **Not a URL extension issue.** Direct URL without `.mp4` extension plays fine.
4. **Not an HTML/CSS/JS issue.** All static HTML tests work, including modals, overlays, custom play buttons, and dynamic src.
5. **Not about `$bindable` or `$props`.** Removing `$bindable`, removing `bind:videoElement` from parent, using local variables — none of it helped.
6. **Not about event handlers or overlays.** A minimal component with zero event handlers and zero overlays still breaks.
7. **Not about setting src after mount.** Using `onMount` + `$effect` to set src imperatively still breaks.
8. **The only difference that matters:** A `<video>` element directly in `MediaDetailModal.svelte`'s template works. The exact same `<video>` element inside any Svelte child component does not.

## Server Logs Pattern (from iPhone)
When the video is stuck loading, the server sees 3-4 Range requests then nothing more:
```
Range: bytes=0-1              (2-byte probe)
Range: bytes=0-262516547      (full file)
Range: bytes=2740424-262516547 (partial retry)
```
No further requests after the third. The video spinner shows forever.

## Environment
- SvelteKit with `@sveltejs/adapter-node`
- Svelte 5 (using `$props`, `$state`, `$derived`, `$effect`)
- Vite dev server
- iPhone 16, iOS 18.6.2, Chrome app (uses WebKit engine)

# iOS Video Loading Fix

## Problem
Videos stuck loading infinitely on iOS Safari/WebKit when rendered inside Svelte child components.

## Root Cause
Svelte 5 creates child component templates in a detached `DocumentFragment` before insertion. iOS WebKit refuses to load video when `src` is set on a detached element.

## Solution
Replace declarative `{src}` with a Svelte action that sets `src` imperatively after DOM connection:

```svelte
function videoSrc(node: HTMLVideoElement, initialSrc: string) {
    if (initialSrc) {
        node.src = initialSrc;
        node.load();
    }
    return {
        update(newSrc: string) {
            if (newSrc && node.getAttribute('src') !== newSrc) {
                node.src = newSrc;
                node.load();
            }
        }
    };
}
```

```svelte
<video use:videoSrc={src} playsinline>
```

## Files Changed
- `src/lib/components/VideoPlayer.svelte`: Added `videoSrc` action, removed `{src}`, added `playsinline`

## Verification
- ✅ Desktop browsers unchanged
- ✅ Quality switching preserved  
- ✅ Cache reload preserved
- ✅ iOS Safari now loads video properly

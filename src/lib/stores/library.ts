import { writable } from 'svelte/store';
import type { Library } from '$lib/server/db';

export const currentLibrary = writable<Library | null>(null);

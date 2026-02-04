export interface Library {
	id: number;
	name: string;
	folder_path: string;
	path_status: 'ok' | 'missing' | 'error';
	path_error: string | null;
	created_at: string;
	updated_at: string;
}

export interface Media {
	id: number;
	library_id: number;
	path: string;
	title: string | null;
	media_type: 'image' | 'video' | 'animated';
	size: number;
	mtime: string;
	birthtime: string;
	created_at: string;
	updated_at: string;
}

export interface Tag {
	id: number;
	name: string;
	library_id: number | null;
	is_global: number;
	created_at: string;
}

export interface MediaTag {
	media_id: number;
	tag_id: number;
	created_at: string;
}

export interface Person {
	id: number;
	name: string;
	role: 'artist' | 'performer';
	library_id: number | null;
	is_global: number;
	created_at: string;
	updated_at: string;
}

export interface ArtistProfile {
	person_id: number;
	style: '2d_animator' | '3d_animator' | 'illustrator' | 'photographer' | 'other' | null;
	created_at: string;
	updated_at: string;
}

export interface PerformerProfile {
	person_id: number;
	age: number | null;
	created_at: string;
	updated_at: string;
}

export interface MediaCredit {
	media_id: number;
	person_id: number;
	created_at: string;
}

export interface SchemaVersion {
	version: number;
	applied_at: string;
}

export interface User {
	id: number;
	username: string;
	password_hash: string;
	role: 'admin' | 'user';
	is_active: number;
	created_at: string;
	updated_at: string;
}

export interface Session {
	id: string;
	user_id: number;
	expires_at: string;
	created_at: string;
	last_used_at: string;
	user_agent: string | null;
	ip_address: string | null;
}

export interface LibraryPermission {
	user_id: number;
	library_id: number;
	created_at: string;
}

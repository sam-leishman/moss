export interface Library {
	id: number;
	name: string;
	folder_path: string;
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
	created_at: string;
	updated_at: string;
}

export interface Tag {
	id: number;
	name: string;
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

import { json } from '@sveltejs/kit';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('api:cleanup');

export const POST = async ({ params }: { params: { id: string } }) => {
	logger.info(`Cleanup endpoint called for library ${params.id}; endpoint is retired. Use /scan instead.`);
	return json(
		{
			success: false,
			message: 'Cleanup is no longer a separate action. Use the scan endpoint to rescan and clean up orphaned items.'
		},
		{ status: 410 }
	);
};

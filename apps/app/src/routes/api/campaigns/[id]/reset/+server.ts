import { db } from '@uniconnect/shared';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, locals }) => {
    if (!locals.user) throw error(401);
    const campaignId = params.id;

    try {
        // Reset all QUEUED recipients back to PENDING
        await db.query(
            `UPDATE campaign_recipients 
             SET status = 'PENDING', sent_at = NULL, error_message = NULL, updated_at = NOW() 
             WHERE campaign_id = $1 AND status = 'QUEUED'`,
            [campaignId]
        );

        // Reset campaign status
        await db.query(
            `UPDATE campaigns 
             SET status = 'DRAFT', started_at = NULL, completed_at = NULL, sent_count = 0, failed_count = 0 
             WHERE id = $1`,
            [campaignId]
        );

        return json({ success: true, message: 'Campaign reset successfully' });
    } catch (err: any) {
        console.error(`[RESET_ERROR] Failed for campaign ${campaignId}:`, err);
        return json({ success: false, message: err.message }, { status: 500 });
    }
};

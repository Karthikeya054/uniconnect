import { db, getCampaignById, getStudents, createRecipients, getCampaignRecipients, getTemplateById } from '@uniconnect/shared';
import { addEmailJob } from '$lib/server/queue';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, locals, request }) => {
    if (!locals.user) throw error(401);
    const campaignId = params.id;

    const campaign = await getCampaignById(campaignId);
    if (!campaign) throw error(404);

    if (locals.user.role === 'UNIVERSITY_OPERATOR' && campaign.university_id !== locals.user.university_id) {
        throw error(403);
    }

    try {
        // 1. Snapshot recipients
        const students = await getStudents(campaign.university_id, 10000);
        if (students.length === 0) {
            return json({ success: false, message: 'No students found in university to initiate campaign' }, { status: 400 });
        }

        await createRecipients(campaignId, students, campaign.recipient_email_key);

        // 2. Fetch created recipients to get tokens
        const recipients = await getCampaignRecipients(campaignId);

        // 3. Check for scheduling
        const body = await request.json().catch(() => ({}));
        const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
        const delay = Math.max(0, scheduledAt.getTime() - Date.now());

        // 4. Enqueue Jobs for only NEW (PENDING) recipients
        let enqueuedCount = 0;
        for (const r of recipients.filter(rect => rect.status === 'PENDING')) {
            const student = students.find(s => s.id === r.student_id);

            if (student) {
                await addEmailJob({
                    recipientId: r.id,
                    campaignId: campaign.id,
                    email: r.to_email,
                    trackingToken: r.tracking_token,
                    templateId: campaign.template_id,
                    mailboxId: campaign.mailbox_id,
                    includeAck: campaign.include_ack,
                    variables: {
                        studentName: student.name,
                        studentExternalId: student.external_id,
                        metadata: student.metadata
                    }
                }, delay);

                // Mark as QUEUED immediately to avoid double processing
                await db.query(`UPDATE campaign_recipients SET status = 'QUEUED' WHERE id = $1`, [r.id]);
                enqueuedCount++;
            }
        }

        // Update campaign status to IN_PROGRESS if we just started sending
        await db.query(`UPDATE campaigns SET status = 'IN_PROGRESS', started_at = NOW() WHERE id = $1 AND (status = 'SCHEDULED' OR status = 'DRAFT' OR status = 'PENDING')`, [campaign.id]);

        return json({
            success: true,
            message: `Successfully enqueued ${enqueuedCount} emails`,
            count: recipients.length,
            scheduledAt: scheduledAt.toISOString()
        });
    } catch (err: any) {
        console.error(`[SCHEDULE_API_ERROR] Failed for campaign ${campaignId}:`, err);
        return json({
            success: false,
            message: err.message || 'Internal server error while scheduling'
        }, { status: 500 });
    }
}

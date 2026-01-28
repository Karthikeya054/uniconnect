import { getCampaignById, getStudents, getTemplateById } from '@uniconnect/shared';
import { addEmailJob } from '$lib/server/queue';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ params, locals, request }) => {
    if (!locals.user) throw error(401);
    const campaignId = params.id;

    const { testEmail } = await request.json().catch(() => ({}));
    if (!testEmail) throw error(400, 'Test email address required');

    const campaign = await getCampaignById(campaignId);
    if (!campaign) throw error(404);

    if (locals.user.role === 'UNIVERSITY_OPERATOR' && campaign.university_id !== locals.user.university_id) {
        throw error(403);
    }

    try {
        // 1. Get a sample student to populate placeholders
        const students = await getStudents(campaign.university_id, 1);
        if (students.length === 0) {
            return json({ success: false, message: 'No students found in university to use as sample data' }, { status: 400 });
        }
        const sampleStudent = students[0];

        // 2. Enqueue a single test job
        const trackingToken = 'test_' + crypto.randomBytes(8).toString('hex');

        const jobId = await addEmailJob({
            recipientId: 'test_recipient',
            campaignId: campaign.id,
            email: testEmail,
            trackingToken: trackingToken,
            templateId: campaign.template_id,
            mailboxId: campaign.mailbox_id,
            includeAck: campaign.include_ack,
            attempts: 1,
            variables: {
                studentName: sampleStudent.name,
                studentExternalId: sampleStudent.external_id,
                metadata: sampleStudent.metadata,
                ...(sampleStudent.metadata || {})
            }
        });

        return json({ success: true, message: `Test email enqueued to ${testEmail}`, jobId });
    } catch (err: any) {
        console.error(`[TEST_EMAIL_API_ERROR] Failed for campaign ${campaignId}:`, err);
        return json({
            success: false,
            message: err.message || 'Internal server error while sending test email'
        }, { status: 500 });
    }
};

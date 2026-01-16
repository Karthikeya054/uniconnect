import { json, error } from '@sveltejs/kit';
import {
    getAssessmentTemplates,
    createAssessmentTemplate,
    updateAssessmentTemplate,
    deleteAssessmentTemplate
} from '@uniconnect/shared';

export const GET = async ({ url, locals }: { url: URL, locals: any }) => {
    if (!locals.user) throw error(401);
    const universityId = url.searchParams.get('universityId') || locals.user.university_id;
    if (!universityId) throw error(400, 'University ID is required');

    const templates = await getAssessmentTemplates(universityId);
    return json(templates);
};

export const POST = async ({ request, locals }: { request: Request, locals: any }) => {
    if (!locals.user) throw error(401);
    const body = await request.json();

    if (!body.university_id) body.university_id = locals.user.university_id;

    const template = await createAssessmentTemplate(body);
    return json(template);
};

export const PATCH = async ({ request, locals }: { request: Request, locals: any }) => {
    if (!locals.user) throw error(401);
    const body = await request.json();
    if (!body.id) throw error(400, 'ID is required');

    const template = await updateAssessmentTemplate(body.id, body);
    return json(template);
};

export const DELETE = async ({ url, locals }: { url: URL, locals: any }) => {
    if (!locals.user || (locals.user.role !== 'UNIVERSITY_OPERATOR' && locals.user.role !== 'ADMIN')) throw error(401);
    const id = url.searchParams.get('id');
    if (!id) throw error(400, 'ID is required');

    await deleteAssessmentTemplate(id);
    return json({ success: true });
};

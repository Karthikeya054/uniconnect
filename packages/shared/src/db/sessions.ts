import { db } from './client';
import crypto from 'crypto';

export interface SessionUser {
    id: string;
    email: string;
    role: string;
    university_id: string | null;
    name: string | null;
    display_name: string | null;
    phone: string | null;
    bio: string | null;
    age: number | null;
    profile_picture_url: string | null;
    universities: { id: string, name: string }[];
    permissions: string[];
}

const SESSION_TTL_HOURS = 168; // 7 days

export async function createSession(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

    await db.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
    );

    return token;
}

export async function validateSession(token: string): Promise<SessionUser | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const allFeatures = [
        'dashboard', 'tasks', 'universities', 'students', 'users',
        'analytics', 'mailboxes', 'templates', 'campaigns',
        'assessments', 'mail-logs', 'permissions'
    ];

    try {
        // Stage 1: Full query with all current features (v2.2+)
        const result = await db.query(
            `
        SELECT 
            u.id, u.email, u.role, u.university_id, u.name, u.display_name, u.phone, u.bio, u.age, u.profile_picture_url,
            COALESCE(
                (
                    SELECT json_agg(json_build_object('id', un.id, 'name', un.name))
                    FROM user_universities uu
                    JOIN universities un ON uu.university_id = un.id
                    WHERE uu.user_id = u.id
                ),
                '[]'::json
            ) as universities,
            COALESCE(rp.features, '[]'::jsonb) as permissions
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN role_permissions rp ON u.role = rp.role
        WHERE s.token_hash = $1 AND s.expires_at > NOW()
        `,
            [tokenHash]
        );

        if (result.rows.length === 0) return null;
        return result.rows[0];
    } catch (e: any) {
        // Fallback Stage 2: Handle missing role_permissions table
        if (e.code === '42P01' && (e.message.includes('role_permissions'))) {
            try {
                const result = await db.query(
                    `
                SELECT 
                    u.id, u.email, u.role, u.university_id, u.name, u.display_name, u.phone, u.bio, u.age, u.profile_picture_url,
                    COALESCE(
                        (
                            SELECT json_agg(json_build_object('id', un.id, 'name', un.name))
                            FROM user_universities uu
                            JOIN universities un ON uu.university_id = un.id
                            WHERE uu.user_id = u.id
                        ),
                        '[]'::json
                    ) as universities
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token_hash = $1 AND s.expires_at > NOW()
                `,
                    [tokenHash]
                );

                if (result.rows.length === 0) return null;
                const user = result.rows[0];
                user.permissions = (user.role === 'ADMIN' || user.role === 'PROGRAM_OPS') ? allFeatures : ['dashboard', 'students'];
                return user;
            } catch (e2: any) {
                // Fallback Stage 3: Extreme fallback - Handle missing user_universities table as well
                if (e2.code === '42P01') {
                    const result = await db.query(
                        `
                    SELECT 
                        u.id, u.email, u.role, u.university_id, u.name, u.display_name, u.phone, u.bio, u.age, u.profile_picture_url
                    FROM sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.token_hash = $1 AND s.expires_at > NOW()
                    `,
                        [tokenHash]
                    );

                    if (result.rows.length === 0) return null;
                    const user = result.rows[0];
                    user.universities = [];
                    user.permissions = (user.role === 'ADMIN' || user.role === 'PROGRAM_OPS') ? allFeatures : ['dashboard', 'students'];
                    return user;
                }
                throw e2;
            }
        }

        // If it's a DIFFERENT error code 42P01 (e.g. user_universities missing in FIRST query)
        // trigger the absolute core fallback
        if (e.code === '42P01') {
            const result = await db.query(
                `
            SELECT 
                u.id, u.email, u.role, u.university_id, u.name, u.display_name, u.phone, u.bio, u.age, u.profile_picture_url
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token_hash = $1 AND s.expires_at > NOW()
            `,
                [tokenHash]
            );

            if (result.rows.length === 0) return null;
            const user = result.rows[0];
            user.universities = [];
            user.permissions = (user.role === 'ADMIN' || user.role === 'PROGRAM_OPS') ? allFeatures : ['dashboard', 'students'];
            return user;
        }

        throw e;
    }
}

export async function invalidateSession(token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
}

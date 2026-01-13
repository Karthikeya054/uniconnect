import { db } from './client';

export interface RolePermission {
    role: string;
    features: string[];
    created_at: Date;
    updated_at: Date;
}

export async function getAllRolePermissions(): Promise<RolePermission[]> {
    const result = await db.query(`SELECT * FROM role_permissions ORDER BY role ASC`);
    return result.rows;
}

export async function getRolePermissions(role: string): Promise<string[]> {
    const result = await db.query(`SELECT features FROM role_permissions WHERE role = $1`, [role]);
    if (result.rows.length === 0) {
        return [];
    }
    return result.rows[0].features;
}

export async function updateRolePermissions(role: string, features: string[]): Promise<void> {
    await db.query(
        `INSERT INTO role_permissions (role, features, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (role) DO UPDATE SET 
            features = EXCLUDED.features,
            updated_at = NOW()`,
        [role, JSON.stringify(features)]
    );
}

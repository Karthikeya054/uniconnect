import { db } from './client';

async function main() {
    const userRole = await db.query("SELECT * FROM users WHERE email = 'admin@example.com'");
    const univ = await db.query("SELECT id FROM universities WHERE slug = 'central-university'");

    if (univ.rows[0]) {
        const univId = univ.rows[0].id;
        if (userRole.rows[0]) {
            await db.query(
                "UPDATE users SET university_id = $1, role = 'UNIVERSITY_OPERATOR' WHERE email = 'admin@example.com'",
                [univId]
            );
            console.log('Updated admin@example.com to be operator of Central University');
        } else {
            console.log('User admin@example.com not found');
        }
    }
    process.exit(0);
}

main().catch(console.error);

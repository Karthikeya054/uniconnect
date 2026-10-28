import { db } from './client';

async function main() {
    await db.query(
        "UPDATE users SET role = 'ADMIN', university_id = NULL WHERE email = 'admin@example.com'"
    );
    console.log('Promoted admin@example.com to ADMIN role');
    process.exit(0);
}

main().catch(console.error);

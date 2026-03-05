import { db } from './client';

async function main() {
    await db.query(
        "UPDATE users SET role = 'ADMIN', university_id = NULL WHERE email = 'user@example.com'"
    );
    console.log('Promoted user@example.com to ADMIN role');
    process.exit(0);
}

main().catch(console.error);

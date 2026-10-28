-- Admin handover: Pavan → Karthik.
--
-- former.admin@example.com is being removed from the admin function. All the
-- mails he used to receive (fee-collection snapshots, budget proposals, access
-- alerts, and any ADMIN/PROGRAM_OPS role-based reports) now go to
-- admin@example.com instead.
--
-- His hardcoded appearances in the recipient lists (fee_snapshot,
-- budget_proposals, access-alert) were replaced with admin@example.com in
-- code. Here we deactivate Pavan so he is also dropped from every role-based
-- recipient query (all of which filter is_active = true) and can no longer sign
-- in. Karthik is already an active ADMIN; the second statement just guarantees
-- it (idempotent).

BEGIN;

UPDATE users
   SET is_active = false, updated_at = now()
 WHERE lower(email) = 'former.admin@example.com';

UPDATE users
   SET role = 'ADMIN', is_active = true, updated_at = now()
 WHERE lower(email) = 'admin@example.com';

COMMIT;

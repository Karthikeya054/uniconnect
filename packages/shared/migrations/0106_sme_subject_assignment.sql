-- Subject → SME assignment, so "Send for Approval" notifies only the SME(s)
-- responsible for that subject (not every SME). subject_key is the canonical
-- subject name (lowercase, & -> and, non-alphanumerics stripped, trailing 's'
-- dropped) — the same normalization the app uses to match a paper's subject.

BEGIN;

CREATE TABLE IF NOT EXISTS sme_subject_assignment (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_key  text NOT NULL,
    sme_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (subject_key, sme_user_id)
);
CREATE INDEX IF NOT EXISTS idx_ssa_subject ON sme_subject_assignment(subject_key);

-- Seed from the SME onboarding sheet.
INSERT INTO sme_subject_assignment (subject_key, sme_user_id)
SELECT v.subject_key, u.id
  FROM (VALUES
    ('backenddevelopment',            'sme1@example.com'),
    ('backenddevelopment',            'sme2@example.com'),
    ('designandanalysisofalgorithm',  'sme3@example.com'),
    ('probabilityandstatistic',       'sme4@example.com'),
    ('probabilityandstatistic',       'sme4.alt@example.com'),
    ('logicalreasoning',              'sme5@example.com'),
    ('logicalreasoning',              'sme6@example.com'),
    ('advancecommunicationskill',     'sme7@example.com'),
    ('aiforfinance',                  'sme8@example.com')
  ) AS v(subject_key, email)
  JOIN users u ON lower(u.email) = v.email
ON CONFLICT (subject_key, sme_user_id) DO NOTHING;

COMMIT;

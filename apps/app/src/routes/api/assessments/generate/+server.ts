import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '@uniconnect/shared';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) throw error(401);

    try {
        const {
            subject_id,
            university_id,
            batch_id,
            branch_id,
            exam_type,
            semester,
            paper_date,
            exam_time,
            duration_minutes,
            course_code,
            exam_title,
            instructions,
            template_id,
            unit_ids = [],
            generation_mode = 'Automatic', // 'Automatic' or 'Modifiable'
            max_marks = 50,
            part_a_type = 'Mixed',
            sets_config = {}, // { 'A': ['L1'], 'B': ['L2'], ... }
            selected_template = 'standard',
            template_config: incoming_template_config
        } = await request.json();

        let template_config = incoming_template_config;

        if (!subject_id) throw error(400, 'Subject ID is required');

        // 1. Fetch Question Pool
        const questionsRes = await db.query(`
            SELECT q.*, t.name as topic_name, u.unit_number 
            FROM assessment_questions q
            JOIN assessment_units u ON q.unit_id = u.id
            LEFT JOIN assessment_topics t ON q.topic_id = t.id
            WHERE u.subject_id = $1
        `, [subject_id]);

        const allQuestions = questionsRes.rows;
        const allPossibleUnitIdsArr = [...new Set(allQuestions.map(q => q.unit_id))];

        if (allQuestions.length === 0) {
            return json({ error: 'No questions found for this subject. Please upload questions first.' }, { status: 400 });
        }

        // 2. Prepare Slots to Process
        const slotsToProcess: any[] = [];
        if (generation_mode === 'Modifiable' && template_config) {
            template_config.forEach((section: any) => {
                const part = section.part || (section.title?.toUpperCase()?.includes('PART A') ? 'A' : (section.title?.toUpperCase()?.includes('PART B') ? 'B' : 'C'));
                section.slots.forEach((slot: any) => {
                    slotsToProcess.push({
                        ...slot,
                        id: slot.id || crypto.randomUUID(),
                        marks: slot.marks || section.marks_per_q,
                        part: part
                    });
                });
            });
        } else {
            const isChaitanya = university_id === '8e5403f9-505a-44d4-add4-aae3efaa9248' || String(selected_template).toLowerCase() === 'cdu';
            const is100 = Number(max_marks) === 100;
            const isMCQ = part_a_type === 'MCQ';
            const isMixed = part_a_type === 'Mixed';

            const countA = isChaitanya ? 10 : (is100 ? (isMCQ ? 20 : 10) : (isMCQ ? 10 : 5));
            const marksA = isChaitanya ? 2 : (isMCQ ? 1 : 2);
            const typeA = isMixed ? 'MIXED' : (isMCQ ? 'MCQ' : 'NORMAL');

            for (let i = 1; i <= countA; i++) {
                slotsToProcess.push({
                    id: crypto.randomUUID(),
                    label: `${i}`,
                    marks: marksA,
                    type: 'SINGLE',
                    unit: 'Auto',
                    hasSubQuestions: false,
                    qType: typeA,
                    part: 'A'
                });
            }

            const realCountB = isChaitanya ? 2 : (is100 ? 5 : 8);
            for (let i = 0; i < realCountB; i++) {
                const marksB = isChaitanya ? 4 : (is100 ? 16 : 5);
                const startNum = countA + 1 + i * 2;
                slotsToProcess.push({
                    id: crypto.randomUUID(),
                    label: `${startNum}`,
                    displayLabel: `${startNum} OR ${startNum + 1}`,
                    marks: marksB,
                    type: 'OR_GROUP',
                    unit: 'Auto',
                    hasSubQuestions: false,
                    qType: 'NORMAL',
                    part: 'B',
                    choices: [
                        { label: `${startNum}`, unit: 'Auto', marks: marksB, hasSubQuestions: false, qType: 'NORMAL' },
                        { label: `${startNum + 1}`, unit: 'Auto', marks: marksB, hasSubQuestions: false, qType: 'NORMAL' }
                    ]
                });
            }

            if (!template_config) {
                template_config = [
                    { title: 'PART A', marks_per_q: marksA, count: countA, slots: slotsToProcess.filter(s => s.part === 'A') },
                    { title: 'PART B', marks_per_q: is100 ? 16 : 5, count: realCountB, slots: slotsToProcess.filter(s => s.part === 'B') }
                ];
            }
        }

        // 2a. Shuffle pool for extreme variety
        const globalShuffledPool = allQuestions.sort(() => Math.random() - 0.5);

        const sets = ['A', 'B', 'C', 'D'];
        const generatedSets: Record<string, any> = {};
        const globalExcluded = new Set<string>(); // Tracking VARIETY across sets

        for (const setName of sets) {
            const setQuestions: any[] = [];
            const setDifficulty = sets_config[setName] || ['ANY'];
            const excludeInSet = new Set<string>();

            // Randomize unit order for each set to ensure different question distribution
            // Use a local shuffle of unit_ids to ensure variety even in unit distribution
            const shuffledUnitIds = [...unit_ids].sort(() => Math.random() - 0.5);
            let setUnitCounter = 0;

            const pickOne = (targetMarks: number, unitId: string, qType?: string, bloomArr?: string[], co_id?: string) => {
                const isShortOrMcq = (q: any) => {
                    const text = (q.question_text || '').toLowerCase();
                    return text.includes('___') || text.includes('....') || (Array.isArray(q.options) && q.options.length > 0);
                };

                const filterPool = (pool: any[], strictMarks: boolean) => {
                    // Stage 1: Prefer questions NOT used in ANY set yet (true variety)
                    let candidates = pool.filter(q => !excludeInSet.has(q.id) && !globalExcluded.has(q.id));

                    // Stage 2: If pool is dry for NEW questions, fallback to cross-set reuse
                    // but ONLY pick questions NOT used in THIS set (still unique within the set)
                    if (candidates.length === 0) {
                        candidates = pool.filter(q => !excludeInSet.has(q.id));
                    }

                    // Shuffle candidates every time to avoid predictable orderings
                    candidates = candidates.sort(() => Math.random() - 0.5);

                    if (strictMarks) {
                        const sFiltered = candidates.filter(q => Number(q.marks) === Number(targetMarks));
                        if (sFiltered.length > 0) candidates = sFiltered;
                        else {
                            // Lenient Fallback: Try +/- 1 mark if strict fails
                            const lFiltered = candidates.filter(q => Math.abs(Number(q.marks) - Number(targetMarks)) <= 1);
                            if (lFiltered.length > 0) candidates = lFiltered;
                        }
                    }

                    if (qType && qType !== 'ANY') {
                        if (qType === 'MIXED') candidates = candidates.filter(q => ['MCQ', 'FILL_IN_BLANK', 'VERY_SHORT', 'SHORT', 'LONG', 'VERY_LONG', 'PARAGRAPH'].includes(q.type || '') || isShortOrMcq(q));
                        else if (qType === 'MCQ') candidates = candidates.filter(q => q.type === 'MCQ' || isShortOrMcq(q));
                        else if (qType === 'NORMAL' && targetMarks < 5) candidates = candidates.filter(q => !['MCQ', 'FILL_IN_BLANK'].includes(q.type || '') && !isShortOrMcq(q));
                        else candidates = candidates.filter(q => q.type === qType);
                    }

                    // Bloom Filter (Difficulty)
                    if (bloomArr && bloomArr.length > 0 && !bloomArr.includes('ANY') && candidates.length > 0) {
                        const bFiltered = candidates.filter(q => bloomArr.includes(q.bloom_level));
                        if (bFiltered.length > 0) candidates = bFiltered;
                    }

                    if (co_id && candidates.length > 0) {
                        const cFiltered = candidates.filter(q => q.co_id === co_id);
                        if (cFiltered.length > 0) candidates = cFiltered;
                    }

                    return candidates;
                };

                const finalize = (cand: any[]) => {
                    const choice = cand[Math.floor(Math.random() * cand.length)];
                    excludeInSet.add(choice.id);
                    globalExcluded.add(choice.id);
                    return {
                        id: choice.id, text: choice.question_text, marks: choice.marks,
                        bloom: choice.bloom_level, co_id: choice.co_id, unit_id: choice.unit_id,
                        type: choice.type || 'NORMAL', options: choice.options, image_url: choice.image_url
                    };
                };

                // Use the global shuffled pool as the base for all selection
                const poolBase = globalShuffledPool;

                // Fallback Chain
                // 1. Strict Unit + Strict Marks
                let p = filterPool(poolBase.filter(q => q.unit_id === unitId), true);
                if (p.length > 0) return finalize(p);

                // 2. Strict Unit + Any Marks
                p = filterPool(poolBase.filter(q => q.unit_id === unitId), false);
                if (p.length > 0) return finalize(p);

                // 3. Any Unit + Strict Marks
                p = filterPool(poolBase, true);
                if (p.length > 0) return finalize(p);

                // 4. Ultimate Fallback (Anything available)
                p = filterPool(poolBase, false);
                if (p.length > 0) return finalize(p);

                return null;
            };

            const pickChoice = (marks: number, uId: string, hasSub: boolean, subMarks?: number[], qType?: string, bloomArr?: string[], co?: string) => {
                const finalBloom = (bloomArr && !bloomArr.includes('ANY')) ? bloomArr : setDifficulty;
                if (!hasSub) {
                    const q = pickOne(marks, uId, qType, finalBloom, co);
                    return q ? [q] : [];
                } else {
                    const split = subMarks || [Number((marks / 2).toFixed(1)), Number((marks / 2).toFixed(1))];
                    const picked: any[] = [];
                    split.forEach((m, idx) => {
                        const q = pickOne(m, uId, qType, finalBloom, co);
                        if (q) picked.push({ ...q, sub_label: `(${String.fromCharCode(idx + 97)})` });
                    });
                    return picked;
                }
            };

            for (const slot of slotsToProcess) {
                // Use shuffled units for this set
                const uToUse = slot.unit === 'Auto' ? (shuffledUnitIds[setUnitCounter++ % shuffledUnitIds.length] || allPossibleUnitIdsArr[0]) : slot.unit;

                if (slot.type === 'OR_GROUP') {
                    const c1 = pickChoice(slot.marks, uToUse, slot.hasSubQuestions, slot.choices?.[0]?.manualMarks, slot.qType, slot.bloom, slot.co);
                    const c2 = pickChoice(slot.marks, uToUse, slot.hasSubQuestions, slot.choices?.[1]?.manualMarks, slot.qType, slot.bloom, slot.co);
                    setQuestions.push({ id: slot.id, type: 'OR_GROUP', part: slot.part, choice1: { questions: c1 }, choice2: { questions: c2 } });
                } else {
                    const qs = pickChoice(slot.marks, uToUse, slot.hasSubQuestions, slot.subMarks, slot.qType, slot.bloom, slot.co);
                    setQuestions.push({ id: slot.id, type: 'SINGLE', part: slot.part, questions: qs, marks: slot.marks });
                }
            }
            generatedSets[setName] = { questions: setQuestions };
        }

        // 3. PERSIST THE PAPER
        const paperRes = await db.query(
            `INSERT INTO assessment_papers (
                university_id, batch_id, branch_id, subject_id, 
                exam_type, semester, paper_date, 
                duration_minutes, max_marks, sets_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id`,
            [
                university_id, batch_id, branch_id, subject_id,
                exam_type, semester, paper_date,
                duration_minutes, max_marks,
                JSON.stringify({
                    ...generatedSets,
                    metadata: {
                        unit_ids,
                        generation_mode,
                        part_a_type,
                        sets_config,
                        selected_template,
                        exam_time,
                        course_code,
                        exam_title,
                        instructions
                    }
                })
            ]
        );

        return json({ id: paperRes.rows[0].id, sets: generatedSets, template_config });
    } catch (err: any) {
        console.error('Generation Error:', err);
        throw error(500, err.message || 'Failed to generate paper');
    }
};

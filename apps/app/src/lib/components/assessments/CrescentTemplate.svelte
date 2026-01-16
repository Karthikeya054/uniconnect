<script lang="ts">
    import { dndzone } from "svelte-dnd-action";
    import { flip } from "svelte/animate";
    import { fade, fly } from "svelte/transition";
    let { 
        paperMeta = $bindable({
            paper_date: '',
            duration_minutes: '180',
            max_marks: '100',
            course_code: 'CS-XXXX',
            exam_title: 'SEMESTER END EXAMINATIONS - NOV/DEC 2025',
            programme: 'B.Tech - COMPUTER SCIENCE AND ENGINEERING',
            semester: '1',
            instructions: 'ANSWER ALL QUESTIONS'
        }),
        currentSetData = $bindable({ questions: [] }),
        paperStructure = [],
        activeSet = 'A',
        courseOutcomes = [],
        questionPool = [],
        mode = 'view' 
    } = $props();

    // Sidebar state
    let isSwapSidebarOpen = $state(false);
    let swapContext = $state<any>(null);

    function openSwapSidebar(index: number, part: 'A' | 'B' | 'C', subPart?: 'q1' | 'q2') {
        const slot = currentSetData.questions[index];
        if (!slot) return;

        let currentQ: any = null;
        if (slot.type === 'SINGLE') {
            currentQ = slot.questions?.[0];
        } else if (slot.type === 'OR_GROUP') {
            currentQ = subPart === 'q1' ? slot.choice1.questions[0] : slot.choice2.questions[0];
        }

        const marks = currentQ?.marks || slot.marks || (part === 'A' ? 2 : 16);
        const alternates = questionPool.filter(q => q.marks === marks && q.id !== currentQ?.id);

        swapContext = {
            slotIndex: index,
            part,
            subPart,
            currentMark: marks,
            alternates
        };
        isSwapSidebarOpen = true;
    }

    function selectAlternate(question: any) {
        if (!swapContext) return;
        const { slotIndex, subPart } = swapContext;
        const slot = currentSetData.questions[slotIndex];

        const newQData = {
            id: question.id,
            text: question.question_text,
            marks: question.marks,
            type: question.type,
            options: question.options,
            co_id: question.co_id,
            bloom: question.bloom_level
        };

        if (slot.type === 'SINGLE') {
            slot.questions = [newQData];
            slot.text = question.question_text;
            slot.id = question.id;
        } else if (slot.type === 'OR_GROUP') {
            if (subPart === 'q1') slot.choice1.questions = [newQData];
            else slot.choice2.questions = [newQData];
        }

        currentSetData.questions = [...currentSetData.questions];
        isSwapSidebarOpen = false;
    }

    // DND Handlers
    const dndFlipDurationMs = 300;

    function handleDndConsider(e: any, part: 'A' | 'B' | 'C') {
        const { items } = e.detail;
        if (part === 'A') {
            const others = currentSetData.questions.filter((s: any) => !isPartASlot(s));
            currentSetData.questions = [...items, ...others];
        } else if (part === 'B') {
            currentSetData.questions = [...partASlots, ...items, ...slotsC];
        } else if (part === 'C') {
            currentSetData.questions = [...partASlots, ...slotsB, ...items];
        }
    }

    function handleDndFinalize(e: any, part: 'A' | 'B' | 'C') {
        const { items } = e.detail;
        if (part === 'A') {
            const others = currentSetData.questions.filter((s: any) => !isPartASlot(s));
            currentSetData.questions = [...items, ...others];
        } else if (part === 'B') {
            currentSetData.questions = [...partASlots, ...items, ...slotsC];
        } else if (part === 'C') {
            currentSetData.questions = [...partASlots, ...slotsB, ...items];
        }
    }

    function addQuestion(part: 'A' | 'B' | 'C') {
        const marks = part === 'A' ? 2 : (part === 'B' ? (Number(paperMeta.max_marks) === 50 ? 5 : 16) : 16);
        const newQ = {
            id: 'manual-' + Math.random().toString(36).substr(2, 9),
            text: 'Click to edit question text...',
            marks: marks,
            type: 'SINGLE',
            co_id: null
        };
        currentSetData.questions = [...currentSetData.questions, newQ];
    }

    function getCOCode(coId: string | undefined) {
        if (!coId) return null;
        return courseOutcomes.find((c: any) => c.id === coId)?.code || null;
    }

    const isEditable = $derived(mode === 'edit');

    // Helper to determine if a slot belongs in Part A (1-mark MCQs or 2-mark questions)
    const isPartASlot = (slot: any) => {
        if (!slot) return false;
        // Check if it's a 1-mark or 2-mark question (Part A questions)
        if (slot.type === 'SINGLE') {
            const marks = slot.questions?.[0]?.marks || slot.marks;
            return marks === 1 || marks === 2;
        }
        // For OR_GROUP, check if both choices are 1 or 2 marks
        if (slot.type === 'OR_GROUP') {
            const marks1 = slot.choice1?.questions?.[0]?.marks || slot.marks;
            const marks2 = slot.choice2?.questions?.[0]?.marks || slot.marks;
            return (marks1 === 1 || marks1 === 2) && (marks2 === 1 || marks2 === 2);
        }
        return false;
    };

    // Smart Partitioning: All 2-mark questions to Part A, everything else to Part B/C
    let partASlots = $derived(currentSetData.questions.filter(isPartASlot));
    let nonPartASlots = $derived(currentSetData.questions.filter((s: any) => !isPartASlot(s)));

    let questionsA = $derived(partASlots);
    let partACount = $derived(partASlots.length);

    let is100m = $derived(Number(paperMeta.max_marks) === 100);
    
    let slotsB = $derived(is100m ? nonPartASlots.slice(0, nonPartASlots.length - 1) : nonPartASlots);
    let slotsC = $derived(is100m ? nonPartASlots.slice(nonPartASlots.length - 1) : []);

    let numberedSections = $derived(() => {
        let current = partASlots.length + 1;
        const b = slotsB.map((s: any) => {
            if (s.type === 'OR_GROUP') {
                const n1 = current;
                const n2 = current + 1;
                current += 2;
                return { ...s, n1, n2 };
            } else {
                const n1 = current;
                current += 1;
                return { ...s, n1 };
            }
        });
        const c = slotsC.map((s: any) => {
            if (s.type === 'OR_GROUP') {
                const n1 = current;
                const n2 = current + 1;
                current += 2;
                return { ...s, n1, n2 };
            } else {
                const n1 = current;
                current += 1;
                return { ...s, n1 };
            }
        });
        return { b, c, totalB: slotsB.length };
    });

    let questionsB = $derived(numberedSections().b);
    let questionsC = $derived(numberedSections().c);
    let partBCount = $derived(numberedSections().totalB);
</script>

<div class="paper-container relative p-[1in] bg-white text-black shadow-none border border-gray-100 {mode === 'preview' ? 'scale-[0.5] origin-top' : ''}">
    <!-- Exact Crescent Header -->
    <div class="relative flex flex-col items-center">
        <!-- Refined Header based on uploaded images -->
        <div class="w-full flex justify-between items-start mb-2">
            <!-- Left: Exact Crescent Logo Image -->
            <div class="w-[300px]">
                <img 
                    src="/crescent-logo.png" 
                    alt="Crescent Logo" 
                    class="h-auto w-full object-contain"
                />
            </div>

            <!-- Right: Course Code & RRN Box -->
            <div class="flex flex-col items-end gap-2 mt-4">
                <div class="text-[12px] font-black text-gray-900 uppercase tracking-tighter">
                    &lt;<span contenteditable="true" bind:innerHTML={paperMeta.course_code} class={isEditable ? '' : 'pointer-events-none'}></span>&gt;
                </div>
                
                <div class="flex items-center gap-2">
                    <span class="text-[11px] font-black text-gray-900 border border-black px-1">RRN</span>
                    <div class="flex border border-black">
                        {#each Array(10) as _}
                            <div class="w-4 h-5 border-r border-black last:border-r-0 bg-white"></div>
                        {/each}
                    </div>
                </div>
            </div>
        </div>

        <!-- Exam Title -->
        <div class="w-full text-center mb-4">
            <h3 
                contenteditable="true" 
                bind:innerHTML={paperMeta.exam_title} 
                class="text-[14px] font-black uppercase tracking-wide border-b border-white hover:border-gray-200 outline-none inline-block pb-0.5 {isEditable ? '' : 'pointer-events-none'}"
            >
                {paperMeta.exam_title}
            </h3>
        </div>

        <!-- Metadata Table (4-row layout as per images) -->
        <div class="w-full mb-6">
            <table class="w-full border-collapse border-2 border-gray-900 text-[10px] leading-tight text-left">
                <tbody>
                    <!-- Row 1: Programme & Branch -->
                    <tr>
                        <td class="border border-gray-900 p-2 font-bold w-[25%] uppercase tracking-tighter">Programme & Branch</td>
                        <td class="border border-gray-900 p-2 text-center w-[2%] font-bold">:</td>
                        <td class="border border-gray-900 p-2 font-black uppercase" colspan="4">
                            <div contenteditable="true" bind:innerHTML={paperMeta.programme} class={isEditable ? '' : 'pointer-events-none'}></div>
                        </td>
                    </tr>
                    <!-- Row 2: Semester & Date/Session -->
                    <tr>
                        <td class="border border-gray-900 p-2 font-bold uppercase tracking-tighter">Semester</td>
                        <td class="border border-gray-900 p-2 text-center font-bold">:</td>
                        <td class="border border-gray-900 p-2 font-black w-[15%]">
                            <div contenteditable="true" bind:innerHTML={paperMeta.semester} class={isEditable ? '' : 'pointer-events-none'}></div>
                        </td>
                        <td class="border border-gray-900 p-2 font-bold w-[25%] uppercase tracking-tighter border-l-2">Date & Session</td>
                        <td class="border border-gray-900 p-2 text-center w-[2%] font-bold">:</td>
                        <td class="border border-gray-900 p-2 font-black uppercase">
                            <span contenteditable="true" bind:innerHTML={paperMeta.paper_date} class={isEditable ? '' : 'pointer-events-none'}>{paperMeta.paper_date}</span>
                            {#if paperMeta.exam_time}
                                <span class="ml-2 text-[9px] font-bold text-gray-500">[{paperMeta.exam_time}]</span>
                            {/if}
                        </td>
                    </tr>
                    <!-- Row 3: Course Code & Name -->
                    <tr>
                        <td class="border border-gray-900 p-2 font-bold uppercase tracking-tighter">Course Code & Name</td>
                        <td class="border border-gray-900 p-2 text-center font-bold">:</td>
                        <td class="border border-gray-900 p-2 font-black uppercase" colspan="4">
                            <span contenteditable="true" bind:innerHTML={paperMeta.course_code} class={isEditable ? '' : 'pointer-events-none'}></span> - <span contenteditable="true" bind:innerHTML={paperMeta.subject_name} class={isEditable ? '' : 'pointer-events-none'}></span>
                        </td>
                    </tr>
                    <!-- Row 4: Duration & Max Marks -->
                    <tr>
                        <td class="border border-gray-900 p-2 font-bold uppercase tracking-tighter">Duration</td>
                        <td class="border border-gray-900 p-2 text-center font-bold">:</td>
                        <td class="border border-gray-900 p-2 font-black w-[15%]">
                            <div contenteditable="true" bind:innerHTML={paperMeta.duration_minutes} class={isEditable ? '' : 'pointer-events-none'}>{paperMeta.duration_minutes} Minutes</div>
                        </td>
                        <td class="border border-gray-900 p-2 font-bold w-[25%] uppercase tracking-tighter border-l-2">Maximum Marks</td>
                        <td class="border border-gray-900 p-2 text-center w-[2%] font-bold">:</td>
                        <td class="border border-gray-900 p-2 font-black">
                            <div contenteditable="true" bind:innerHTML={paperMeta.max_marks} class={isEditable ? '' : 'pointer-events-none'}>{paperMeta.max_marks}</div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Instructions -->
        <div class="w-full text-center mb-6">
            <p 
                contenteditable="true" 
                bind:innerHTML={paperMeta.instructions} 
                class="text-[9px] font-black uppercase tracking-[0.3em] font-serif italic mb-2 {isEditable ? '' : 'pointer-events-none'}"
            >
                &lt; {paperMeta.instructions} &gt;
            </p>
            <div class="text-[11px] font-black uppercase text-gray-900 tracking-[0.2em] border-b-2 border-gray-900 inline-block pb-0.5">
                ANSWER ALL QUESTIONS
            </div>
        </div>
    </div>

    <!-- Part A -->
    <div class="mt-8 section-part-a">
        <div 
            contenteditable="true"
            class="w-full text-center font-black text-xs uppercase mb-4 border border-black p-1 {isEditable ? '' : 'pointer-events-none'}"
        >
            {paperStructure[0]?.title || 'PART A'} 
            ({partACount} X {paperStructure[0]?.marks_per_q || (is100m ? 2 : 2)} = {partACount * (paperStructure[0]?.marks_per_q || 2)} MARKS)
        </div>
        <div 
            class="w-full border border-black divide-y divide-black"
            use:dndzone={{items: questionsA, flipDurationMs: dndFlipDurationMs, dragDisabled: !isEditable}}
            onconsider={(e) => handleDndConsider(e, 'A')}
            onfinalize={(e) => handleDndFinalize(e, 'A')}
        >
            {#if questionsA.length > 0}
                {#each questionsA as slot, i (slot.id)}
                    <div animate:flip={{duration: dndFlipDurationMs}}>
                    {#if slot.type === 'SINGLE'}
                        {#each slot.questions || [] as q}
                            <div class="flex min-h-[40px] page-break-avoid relative group">
                                {#if isEditable}
                                    <div class="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden cursor-grab active:cursor-grabbing">
                                        <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10h2v2H7v-2zm0 4h2v2H7v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>
                                    </div>
                                {/if}

                                <div class="w-10 border-r border-black p-2 text-center text-[10px] font-bold">
                                    {i + 1}.
                                </div>
                                <div class="flex-1 p-2 text-[10px] leading-relaxed group relative">
                                    <div class="flex justify-between items-start gap-4">
                                        <div contenteditable="true" bind:innerHTML={q.text} class="flex-1 {isEditable ? '' : 'pointer-events-none'}"></div>
                                        {#if q.type === 'MCQ'}
                                            <div class="flex-shrink-0 font-black text-[11px] whitespace-nowrap">[&nbsp;&nbsp;&nbsp;&nbsp;]</div>
                                        {/if}
                                    </div>
                                    
                                    {#if q.options && q.options.length > 0}
                                        <div class="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 pl-8">
                                            {#each q.options as opt}
                                                <div class="text-[10px] font-medium leading-tight">{opt}</div>
                                            {/each}
                                        </div>
                                    {/if}

                                    {#if isEditable}
                                        <button 
                                            onclick={() => openSwapSidebar(currentSetData.questions.indexOf(slot), 'A')}
                                            class="absolute -right-2 top-0 opacity-0 group-hover:opacity-100 bg-indigo-600 text-white px-2 py-1 rounded-md shadow-lg transition-all z-20 print:hidden text-[9px] font-black tracking-widest flex items-center gap-1"
                                        >
                                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                            SWAP
                                        </button>
                                    {/if}
                                </div>
                                <div class="w-20 border-l border-black p-2 text-center text-[8px] font-black text-gray-400 flex flex-col justify-center gap-1">
                                    <span class="uppercase">({getCOCode(q.co_id) || ''})</span>
                                    <span class="text-black font-black">({q.marks})</span>
                                </div>
                            </div>
                        {/each}
                    {:else}
                        <!-- OR GROUP in Part A -->
                        <div class="p-2 bg-gray-50/50">
                             <div class="text-[10px] font-bold text-center">Slot {i+1} (OR Question Support)</div>
                        </div>
                    {/if}
                    </div>
                {/each}
            {:else}
                {#each Array(Number(paperMeta.max_marks) === 50 ? 5 : 10) as _, i}
                    <div class="flex h-[40px]">
                        <div class="w-10 border-r border-black p-2 text-center text-[10px] font-bold">{i + 1}.</div>
                        <div class="flex-1 p-2 text-[10px] italic text-gray-300">Question Text Placeholder</div>
                        <div class="w-20 border-l border-black bg-gray-50/20"></div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>

    <!-- Part B -->
    <div class="mt-12 section-page-break section-part-b">
        <div 
            contenteditable="true"
            class="w-full text-center font-black text-xs uppercase mb-4 border border-black p-1 {isEditable ? '' : 'pointer-events-none'}"
        >
            {paperStructure[1]?.title || 'PART B'} 
            ({partBCount} X {paperStructure[1]?.marks_per_q || 5} = {partBCount * (paperStructure[1]?.marks_per_q || 5)} MARKS)
        </div>
        <div 
            class="space-y-6"
            use:dndzone={{items: questionsB, flipDurationMs: dndFlipDurationMs, dragDisabled: !isEditable}}
            onconsider={(e) => handleDndConsider(e, 'B')}
            onfinalize={(e) => handleDndFinalize(e, 'B')}
        >
            {#if questionsB.length > 0}
                {#each questionsB as slot, idx (slot.id)}
                    <div animate:flip={{duration: dndFlipDurationMs}}>
                    {#if slot.type === 'OR_GROUP'}
                        <div class="border-2 border-black page-break-avoid mb-6 relative group">
                            {#if isEditable}
                                <div class="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden cursor-grab active:cursor-grabbing">
                                    <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10h2v2H7v-2zm0 4h2v2H7v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>
                                </div>
                            {/if}
                            <!-- Choice 1 -->
                            {#each slot.choice1.questions as q, subIdx}
                                <div class="flex border-b border-black last:border-b-0 min-h-[50px]">
                                <div class="w-12 border-r border-black p-2 text-center text-[11px] font-black">
                                    {subIdx === 0 ? slot.n1 + '.' : ''}
                                </div>
                                    <div class="w-10 border-r border-black p-2 text-center text-[10px] font-bold flex items-center justify-center">
                                        {q.sub_label || ''}
                                    </div>
                                    <div class="flex-1 p-3 text-[11px] leading-relaxed">
                                        <div contenteditable="true" bind:innerHTML={q.text} class={isEditable ? '' : 'pointer-events-none'}></div>
                                        
                                        {#if q.options && q.options.length > 0}
                                            <div class="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 pl-8">
                                                {#each q.options as opt}
                                                    <div class="text-[10px] font-medium leading-tight">{opt}</div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="w-20 border-l border-black p-2 text-center flex flex-col items-center justify-center gap-1 group/btn relative">
                                        <span class="text-[8px] font-black text-gray-400 uppercase">({getCOCode(q.co_id) || ''})</span>
                                        <span class="text-[10px] font-black">({q.marks})</span>
                                        {#if isEditable}
                                            <button 
                                                onclick={() => openSwapSidebar(currentSetData.questions.indexOf(slot), 'B', 'q1')}
                                                class="absolute -right-2 top-0 opacity-0 group-hover/btn:opacity-100 bg-indigo-600 text-white px-2 py-1 rounded-md shadow-lg transition-all z-20 print:hidden text-[9px] font-black tracking-widest"
                                            >
                                                SWAP
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                            
                            <!-- OR Separator -->
                            <div class="w-full text-center text-[11px] font-black uppercase py-1.5 border-b border-black bg-gray-50/50 italic tracking-[0.3em]">
                                (OR)
                            </div>

                            <!-- Choice 2 -->
                            {#each slot.choice2.questions as q, subIdx}
                                <div class="flex border-b border-black last:border-b-0 min-h-[50px]">
                                <div class="w-12 border-r border-black p-2 text-center text-[11px] font-black">
                                    {subIdx === 0 ? slot.n2 + '.' : ''}
                                </div>
                                    <div class="w-10 border-r border-black p-2 text-center text-[10px] font-bold flex items-center justify-center">
                                        {q.sub_label || ''}
                                    </div>
                                    <div class="flex-1 p-3 text-[11px] leading-relaxed">
                                        <div contenteditable="true" bind:innerHTML={q.text} class={isEditable ? '' : 'pointer-events-none'}></div>
                                        
                                        {#if q.options && q.options.length > 0}
                                            <div class="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 pl-8">
                                                {#each q.options as opt}
                                                    <div class="text-[10px] font-medium leading-tight">{opt}</div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="w-20 border-l border-black p-2 text-center flex flex-col items-center justify-center gap-1 group/btn relative">
                                        <span class="text-[8px] font-black text-gray-400 uppercase">({getCOCode(q.co_id) || ''})</span>
                                        <span class="text-[10px] font-black">({q.marks})</span>
                                        {#if isEditable}
                                            <button 
                                                onclick={() => openSwapSidebar(currentSetData.questions.indexOf(slot), 'B', 'q2')}
                                                class="absolute -right-2 top-0 opacity-0 group-hover/btn:opacity-100 bg-indigo-600 text-white px-2 py-1 rounded-md shadow-lg transition-all z-20 print:hidden text-[9px] font-black tracking-widest"
                                            >
                                                SWAP
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <!-- SINGLE in Part B -->
                        <div class="border-2 border-black page-break-avoid mb-6 relative group">
                            {#if isEditable}
                                <div class="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden cursor-grab active:cursor-grabbing">
                                    <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10h2v2H7v-2zm0 4h2v2H7v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>
                                </div>
                            {/if}
                            {#each slot.questions || [] as q}
                                <div class="flex min-h-[50px]">
                                    <div class="w-12 border-r border-black p-2 text-center text-[11px] font-black">
                                        {slot.n1 + '.'}
                                    </div>
                                    <div class="flex-1 p-3 text-[11px] leading-relaxed group relative">
                                        <div contenteditable="true" bind:innerHTML={q.text} class="flex-1 {isEditable ? '' : 'pointer-events-none'}"></div>
                                        
                                        {#if q.options && q.options.length > 0}
                                            <div class="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 pl-8">
                                                {#each q.options as opt}
                                                    <div class="text-[10px] font-medium leading-tight">{opt}</div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="w-20 border-l border-black p-2 text-center flex flex-col items-center justify-center gap-1 group/btn relative">
                                        <span class="text-[8px] font-black text-gray-400 uppercase">({getCOCode(q.co_id) || ''})</span>
                                        <span class="text-[10px] font-black">({q.marks})</span>
                                        {#if isEditable}
                                            <button 
                                                onclick={() => openSwapSidebar(currentSetData.questions.indexOf(slot), 'B')}
                                                class="absolute -right-2 top-0 opacity-0 group-hover/btn:opacity-100 bg-indigo-600 text-white px-2 py-1 rounded-md shadow-lg transition-all z-20 print:hidden text-[9px] font-black tracking-widest"
                                            >
                                                SWAP
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                    </div>
                {/each}
            {:else}
                <div class="border border-dashed border-gray-200 p-10 text-center text-[10px] text-gray-300 italic">
                    Part B Questions will appear here
                </div>
            {/if}
        </div>
    </div>

    {#if is100m}
        <div class="mt-12 section-page-break section-part-c">
             <div 
                contenteditable="true"
                class="w-full text-center font-black text-xs uppercase mb-4 border border-black p-1 {isEditable ? '' : 'pointer-events-none'}"
            >
                {#if paperStructure[2]}
                    {paperStructure[2].title} ({paperStructure[2].answered_count} X {paperStructure[2].marks_per_q} = {paperStructure[2].answered_count * paperStructure[2].marks_per_q} MARKS)
                {:else}
                    PART C (1 X 16 = 16 MARKS)
                {/if}
            </div>
        <div 
            class="space-y-6"
            use:dndzone={{items: questionsC, flipDurationMs: dndFlipDurationMs, dragDisabled: !isEditable}}
            onconsider={(e) => handleDndConsider(e, 'C')}
            onfinalize={(e) => handleDndFinalize(e, 'C')}
        >
                {#each questionsC as slot, idx (slot.id)}
                    <div animate:flip={{duration: dndFlipDurationMs}}>
                    <div class="border-2 border-black page-break-avoid relative group">
                        {#if isEditable}
                                <div class="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden cursor-grab active:cursor-grabbing">
                                    <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10h2v2H7v-2zm0 4h2v2H7v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>
                                </div>
                        {/if}
                        <!-- Choice 1 -->
                        {#each slot.choice1.questions as q, subIdx}
                            <div class="flex border-b border-black last:border-b-0 min-h-[50px]">
                                <div class="w-12 border-r border-black p-2 text-center text-[11px] font-black">
                                    {subIdx === 0 ? slot.n1 + '.' : ''}
                                </div>
                                <div class="w-10 border-r border-black p-2 text-center text-[10px] font-bold flex items-center justify-center">
                                    {q.sub_label || ''}
                                </div>
                                <div class="flex-1 p-3 text-[11px] leading-relaxed">
                                    <div contenteditable="true" bind:innerHTML={q.text} class={isEditable ? '' : 'pointer-events-none'}></div>
                                    
                                    {#if q.options && q.options.length > 0}
                                        <div class="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 pl-8">
                                            {#each q.options as opt}
                                                <div class="text-[10px] font-medium leading-tight">{opt}</div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                                <div class="w-20 border-l border-black p-2 text-center flex flex-col items-center justify-center gap-1 group/btn relative">
                                    <span class="text-[8px] font-black text-gray-400 uppercase">({getCOCode(q.co_id) || ''})</span>
                                    <span class="text-[10px] font-black">({q.marks})</span>
                                    {#if isEditable}
                                        <button 
                                            onclick={() => openSwapSidebar(currentSetData.questions.indexOf(slot), 'C', 'q1')}
                                            class="absolute -right-2 top-0 opacity-0 group-hover/btn:opacity-100 bg-indigo-600 text-white px-2 py-1 rounded-md shadow-lg transition-all z-20 print:hidden text-[9px] font-black"
                                        >
                                            SWAP
                                        </button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                        
                        <!-- OR Separator -->
                        <div class="w-full text-center text-[11px] font-black uppercase py-1.5 border-b border-black bg-gray-50/50 italic tracking-[0.3em]">
                            (OR)
                        </div>

                        <!-- Choice 2 -->
                        {#each slot.choice2.questions as q, subIdx}
                            <div class="flex border-b border-black last:border-b-0 min-h-[50px]">
                                <div class="w-12 border-r border-black p-2 text-center text-[11px] font-black">
                                    {subIdx === 0 ? slot.n2 + '.' : ''}
                                </div>
                                <div class="w-10 border-r border-black p-2 text-center text-[10px] font-bold flex items-center justify-center">
                                    {q.sub_label || ''}
                                </div>
                                <div class="flex-1 p-3 text-[11px] leading-relaxed">
                                    <div contenteditable="true" bind:innerHTML={q.text} class={isEditable ? '' : 'pointer-events-none'}></div>
                                    
                                    {#if q.options && q.options.length > 0}
                                        <div class="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 pl-8">
                                            {#each q.options as opt}
                                                <div class="text-[10px] font-medium leading-tight">{opt}</div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                                <div class="w-20 border-l border-black p-2 text-center flex flex-col items-center justify-center gap-1 group/btn relative">
                                    <span class="text-[8px] font-black text-gray-400 uppercase">({getCOCode(q.co_id) || ''})</span>
                                    <span class="text-[10px] font-black">({q.marks})</span>
                                    {#if isEditable}
                                        <button 
                                            onclick={() => openSwapSidebar(currentSetData.questions.indexOf(slot), 'C', 'q2')}
                                            class="absolute -right-2 top-0 opacity-0 group-hover/btn:opacity-100 bg-indigo-600 text-white px-2 py-1 rounded-md shadow-lg transition-all z-20 print:hidden text-[9px] font-black"
                                        >
                                            SWAP
                                        </button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Bottom Signatures -->
    <div class="mt-20 grid grid-cols-2 gap-20">
        <div class="border-t border-black pt-2 text-center">
            <p class="text-[9px] font-black uppercase">Name & Signature of DAAC Member</p>
        </div>
        <div class="border-t border-black pt-2 text-center">
            <p class="text-[9px] font-black uppercase">Name & Signature of DAAC Member</p>
        </div>
    </div>
</div>

{#if isSwapSidebarOpen && swapContext}
    <div 
        class="fixed inset-0 z-[100] flex justify-end"
        transition:fade={{duration: 200}}
    >
        <!-- Overlay -->
        <button 
            class="absolute inset-0 bg-black/40 backdrop-blur-sm w-full h-full border-none cursor-default"
            onclick={() => isSwapSidebarOpen = false}
            aria-label="Close Sidebar"
        ></button>

        <!-- Sidebar -->
        <div 
            class="relative w-[400px] bg-white h-full shadow-2xl flex flex-col"
            transition:fly={{x: 400, duration: 300}}
        >
            <div class="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                    <h2 class="text-lg font-black text-gray-900 tracking-tight">SWAP QUESTION</h2>
                    <p class="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">
                        Displaying {swapContext.currentMark} Mark Alternates
                    </p>
                </div>
                <button 
                    onclick={() => isSwapSidebarOpen = false}
                    class="p-2 hover:bg-white rounded-full transition-colors shadow-sm"
                >
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                {#if swapContext.alternates.length === 0}
                    <div class="flex flex-col items-center justify-center h-64 text-gray-400 text-center space-y-4">
                        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </div>
                        <p class="text-xs font-bold uppercase tracking-widest leading-loose">
                            No alternative questions found<br/>in the question bank for {swapContext.currentMark} marks.
                        </p>
                    </div>
                {:else}
                    {#each swapContext.alternates as q}
                        <button 
                            onclick={() => selectAlternate(q)}
                            class="w-full text-left bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group relative overflow-hidden"
                        >
                            <!-- Selection Overlay -->
                            <div class="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/[0.02] transition-colors"></div>
                            
                            <div class="flex justify-between items-start gap-4 mb-3">
                                <span class="px-2 py-0.5 bg-gray-900 text-white text-[9px] font-black rounded-md uppercase tracking-tighter italic">
                                    {q.bloom_level}
                                </span>
                                <span class="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                                    {getCOCode(q.co_id) || 'General'}
                                </span>
                            </div>

                            <p class="text-xs leading-relaxed text-gray-800 font-medium">
                                {q.question_text}
                            </p>

                            <div class="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                                <span class="text-[10px] text-gray-400 font-black uppercase tracking-tighter">{q.marks} Marks</span>
                                <span class="opacity-0 group-hover:opacity-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest transition-opacity flex items-center gap-1">
                                    Select This
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                                </span>
                            </div>
                        </button>
                    {/each}
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .paper-container {
        font-family: 'Times New Roman', Times, serif;
    }

    @media print {
        .section-page-break {
            break-before: page;
            -webkit-column-break-before: always;
            page-break-before: always;
            margin-top: 0 !important;
        }

        .page-break-avoid {
            break-inside: avoid;
            -webkit-column-break-inside: avoid;
            page-break-inside: avoid;
        }

        /* Ensure header doesn't get pushed to new page alone */
        .paper-container {
            padding: 0.5in !important;
        }
    }

    [contenteditable="true"]:hover {
        background: rgba(99, 102, 241, 0.05);
        cursor: text;
    }
    
    [contenteditable="true"]:focus {
        background: rgba(99, 102, 241, 0.1);
        outline: none;
    }

    :global(.tracking-widest) {
        letter-spacing: 0.15em;
    }

    /* Transition backdrop */
    :global(.fixed) {
        transition: all 0.3s ease;
    }
</style>

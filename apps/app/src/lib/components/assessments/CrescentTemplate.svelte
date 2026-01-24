<script lang="ts">
    import { dndzone } from "svelte-dnd-action";
    import { flip } from "svelte/animate";
    import { fade, fly, slide } from "svelte/transition";
    import AssessmentEditable from './shared/AssessmentEditable.svelte';
    import AssessmentSlotSingle from './shared/AssessmentSlotSingle.svelte';
    import AssessmentSlotOrGroup from './shared/AssessmentSlotOrGroup.svelte';
    import AssessmentRowActions from './shared/AssessmentRowActions.svelte';
    import AssessmentMcqOptions from './shared/AssessmentMcqOptions.svelte';

    let { 
        paperMeta = $bindable({}), 
        currentSetData = $bindable({ questions: [] }),
        paperStructure = [],
        activeSet = 'A',
        courseOutcomes = [],
        questionPool = [],
        mode = 'view' 
    } = $props();

    let isSwapSidebarOpen = $state(false);
    let swapContext = $state<any>(null);
    const isEditable = $derived(mode === 'edit');

    let questionsA = $derived(safeFilter(currentSetData, 'A'));
    let questionsB = $derived(safeFilter(currentSetData, 'B'));
    let questionsC = $derived(safeFilter(currentSetData, 'C'));

    function safeFilter(data: any, part: string) {
        if (!data) return [];
        const arr = (Array.isArray(data) ? data : (data?.questions || [])).filter(Boolean);
        return arr.filter((s: any) => s.part === part);
    }

    function handleDndSync(part: string, items: any[]) {
        const otherQuestions = (Array.isArray(currentSetData) ? currentSetData : currentSetData.questions).filter((q: any) => q.part !== part);
        const result = [...otherQuestions, ...items.map(i => ({...i, part}))];
        if (Array.isArray(currentSetData)) currentSetData = result;
        else currentSetData.questions = result;
    }

    function updateText(val: string, type: 'META' | 'QUESTION', key: string, slotId?: string, qId?: string) {
        if (!isEditable) return;
        if (type === 'META') (paperMeta as any)[key] = val;
        else {
            const arr = Array.isArray(currentSetData) ? currentSetData : currentSetData.questions;
            const slot = arr.find((s: any) => s.id === slotId);
            if (!slot) return;
            
            let q: any = null;
            if (slot.type === 'OR_GROUP') {
                 q = (slot.choice1?.questions || []).find((item: any) => item.id === qId) || 
                     (slot.choice2?.questions || []).find((item: any) => item.id === qId);
            } else {
                 q = (slot.questions || [slot]).find((item: any) => item.id === qId);
            }
            
            if (q) { 
                q.text = val; 
                q.question_text = val; 
                if(Array.isArray(currentSetData)) currentSetData = [...currentSetData]; 
                else currentSetData.questions = [...currentSetData.questions]; 
            }
        }
    }

    function removeQuestion(slot: any) {
        if (!confirm('Are you sure?')) return;
        if (Array.isArray(currentSetData)) currentSetData = currentSetData.filter((s: any) => s.id !== slot.id);
        else currentSetData.questions = currentSetData.questions.filter((s: any) => s.id !== slot.id);
    }

    function openSwapSidebar(slot: any, part: string, subPart?: 'q1' | 'q2') {
        const cQ = slot.type === 'OR_GROUP' ? (subPart === 'q1' ? slot.choice1?.questions?.[0] : slot.choice2?.questions?.[0]) : (slot.questions?.[0] || slot);
        const marks = Number(cQ?.marks || slot.marks || (part === 'A' ? 2 : 16));
        const arr = Array.isArray(currentSetData) ? currentSetData : currentSetData.questions;
        const index = arr.indexOf(slot);
        
        swapContext = { 
            slotIndex: index, 
            part, 
            subPart, 
            currentMark: marks,
            alternates: (questionPool || []).filter((q: any) => Number(q.marks || q.mark) === marks && q.id !== cQ?.id) 
        };
        isSwapSidebarOpen = true;
    }

    function selectAlternate(question: any) {
        if (!swapContext) return;
        const arr = Array.isArray(currentSetData) ? currentSetData : currentSetData.questions;
        const slot = arr[swapContext.slotIndex];
        const nQ = { id: question.id, text: question.question_text, marks: question.marks, options: question.options };
        if (slot.type === 'OR_GROUP') { if(swapContext.subPart === 'q1') slot.choice1.questions = [nQ]; else slot.choice2.questions = [nQ]; }
        else slot.questions = [nQ];
        if(Array.isArray(currentSetData)) currentSetData = [...currentSetData]; else currentSetData.questions = [...currentSetData.questions];
        isSwapSidebarOpen = false;
    }

    const calcTotal = (qs: any[]) => (qs || []).reduce((s, slot) => {
        if (!slot) return s;
        const marks = Number(slot.marks || (slot.type === 'OR_GROUP' ? (slot.choice1?.questions?.[0]?.marks || 0) : (slot.questions?.[0]?.marks || 0)));
        return s + (slot.type === 'OR_GROUP' ? marks * 2 : marks);
    }, 0);

    let totalMarksA = $derived(calcTotal(questionsA));
    let totalMarksB = $derived(calcTotal(questionsB));
    let totalMarksC = $derived(calcTotal(questionsC));
</script>

<div class="h-full overflow-hidden flex flex-col xl:flex-row relative bg-gray-100 dark:bg-slate-900/50">
    <div class="flex-1 overflow-auto p-4 sm:p-8">
        <div id="crescent-paper-actual" class="mx-auto bg-white p-[0.5in] shadow-2xl transition-all duration-500 font-serif text-black relative" style="width: 8.27in; min-height: 11.69in;">
            
            <!-- Header (Exact Match) -->
            <div class="header-container flex flex-col items-center mb-4">
                 <img src="/crescent-logo.png" alt="Crescent Logo" class="h-16 mb-2" />
                 <div class="text-center">
                    <div class="text-[8pt] font-black uppercase">B.S. Abdur Rahman</div>
                    <div class="text-[20pt] font-black tracking-tight text-indigo-900 leading-none">Crescent</div>
                    <div class="text-[8pt] font-bold">Institute of Science & Technology</div>
                    <div class="text-[6pt] font-medium">(Deemed to be University u/s 3 of the UGC Act, 1956)</div>
                 </div>

                 <!-- RRN & Course Code -->
                 <div class="absolute top-[0.5in] right-[0.5in] flex flex-col items-end gap-2">
                    <div class="flex items-center gap-2">
                        <span class="text-[9pt] font-bold uppercase">&lt;COURSE CODE&gt;</span>
                        <AssessmentEditable bind:value={paperMeta.course_code} onUpdate={(v: string) => updateText(v, 'META', 'course_code')} class="font-bold border-b border-black px-1" />
                    </div>
                    <div class="flex items-center gap-1 mt-2">
                        <span class="text-[9pt] font-bold">RRN</span>
                        <div class="flex border-y border-r border-black">
                            {#each Array(11) as _, i}
                                <div class="w-5 h-5 border-l border-black"></div>
                            {/each}
                        </div>
                    </div>
                 </div>
            </div>

            <!-- Title -->
            <div class="text-center my-6 font-bold uppercase text-[11pt]">
                <AssessmentEditable bind:value={paperMeta.exam_title} onUpdate={(v: string) => updateText(v, 'META', 'exam_title')} class="w-full text-center" />
            </div>

            <!-- Metadata Table (Exact Match) -->
            <table class="w-full border-collapse border border-black text-[9pt] mb-6">
                <tbody>
                    <tr>
                        <td class="border border-black p-1 w-1/4 font-bold">Programme & Branch</td>
                        <td class="border border-black p-1 w-1/4 flex gap-2">: <AssessmentEditable bind:value={paperMeta.programme} onUpdate={(v: string) => updateText(v, 'META', 'programme')} class="flex-1" /></td>
                        <td colspan="3" class="border border-black bg-gray-50/20"></td>
                    </tr>
                    <tr>
                        <td class="border border-black p-1 font-bold">Semester</td>
                        <td class="border border-black p-1">: <AssessmentEditable bind:value={paperMeta.semester} onUpdate={(v: string) => updateText(v, 'META', 'semester')} /></td>
                        <td class="border border-black p-1 font-bold">Date & Session</td>
                        <td class="border border-black p-1">: <AssessmentEditable bind:value={paperMeta.paper_date} onUpdate={(v: string) => updateText(v, 'META', 'paper_date')} /></td>
                    </tr>
                    <tr>
                        <td class="border border-black p-1 font-bold">Course Code & Name</td>
                        <td colspan="3" class="border border-black p-1">: <AssessmentEditable bind:value={paperMeta.subject_name} onUpdate={(v: string) => updateText(v, 'META', 'subject_name')} /></td>
                    </tr>
                    <tr>
                        <td class="border border-black p-1 font-bold">Duration</td>
                        <td class="border border-black p-1">: <AssessmentEditable bind:value={paperMeta.duration_minutes} onUpdate={(v: string) => updateText(v, 'META', 'duration_minutes')} /> minutes</td>
                        <td class="border border-black p-1 font-bold">Maximum Marks</td>
                        <td class="border border-black p-1">: <AssessmentEditable bind:value={paperMeta.max_marks} onUpdate={(v: string) => updateText(v, 'META', 'max_marks')} /></td>
                    </tr>
                </tbody>
            </table>

            <div class="text-center italic text-[9pt] mb-4">
                <AssessmentEditable bind:value={paperMeta.instructions} onUpdate={(v: string) => updateText(v, 'META', 'instructions')} class="w-full text-center" />
            </div>

            <div class="space-y-4">
                <!-- PART A -->
                <div class="border-t-2 border-b-2 border-black py-1 text-center font-bold uppercase tracking-widest text-[10pt]">
                    PART A ({questionsA.length} X {questionsA[0]?.marks || 2} = {totalMarksA} MARKS)
                </div>
                <div class="w-full" use:dndzone={{ items: questionsA, flipDurationMs: 200 }} onconsider={(e) => handleDndSync('A', e.detail.items)} onfinalize={(e) => handleDndSync('A', e.detail.items)}>
                    {#each questionsA as q, i (q.id)}
                        <div animate:flip={{duration: 200}} class="border-b border-black last:border-b-0 min-h-[30px] flex group relative">
                            <div class="px-2 py-1 border-r border-black w-10 text-center font-bold">{i+1}.</div>
                            <div class="flex-1 px-4 py-1 relative">
                                <AssessmentRowActions 
                                    {isEditable}
                                    onSwap={() => openSwapSidebar(q, 'A')}
                                    onDelete={() => removeQuestion(q)}
                                />
                                <AssessmentEditable 
                                    bind:value={q.text} 
                                    onUpdate={(v: string) => updateText(v, 'QUESTION', 'text', q.id, q.id)}
                                    multiline={true} 
                                />
                                <AssessmentMcqOptions options={q.options} />
                            </div>
                            <div class="w-16 border-l border-black text-center py-1 font-bold">({q.marks || 2})</div>
                        </div>
                    {/each}
                </div>

                <!-- PART B -->
                <div class="border-t-2 border-b-2 border-black py-1 text-center font-bold uppercase tracking-widest text-[10pt] mt-8">
                    PART B ({questionsB.length} X {questionsB[0]?.marks || 16} = {totalMarksB} MARKS)
                </div>
                <div class="w-full" use:dndzone={{ items: questionsB, flipDurationMs: 200 }} onconsider={(e) => handleDndSync('B', e.detail.items)} onfinalize={(e) => handleDndSync('B', e.detail.items)}>
                    {#each questionsB as slot, i (slot.id)}
                        <div animate:flip={{duration: 200}} class="border-b-2 border-black mb-4">
                             <!-- Choice 1 -->
                             <div class="flex border-b border-black group relative">
                                <div class="w-10 border-r border-black flex items-center justify-center font-bold text-[9pt]">{questionsA.length + i + 1}.a</div>
                                <div class="flex-1 px-4 py-2 relative">
                                    <AssessmentRowActions 
                                        {isEditable}
                                        onSwap={() => openSwapSidebar(slot, 'B', 'q1')}
                                        onDelete={() => removeQuestion(slot)}
                                    />
                                    {#if slot.choice1?.questions}
                                        <div class="space-y-3">
                                            {#each slot.choice1.questions as q, subIdx}
                                                <div class="flex gap-2">
                                                    {#if slot.choice1.questions.length > 1}
                                                        <span class="font-bold min-w-[20px] text-[9pt]">({subIdx === 0 ? 'i' : 'ii'})</span>
                                                    {/if}
                                                    <div class="flex-1">
                                                        <AssessmentEditable 
                                                            bind:value={q.text}
                                                            onUpdate={(v: string) => updateText(v, 'QUESTION', 'text', slot.id, q.id)}
                                                            multiline={true}
                                                            class="text-[10pt]"
                                                        />
                                                        <AssessmentMcqOptions options={q.options} />
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                                <div class="w-16 border-l border-black flex items-center justify-center font-bold text-[9pt]">({slot.choice1?.questions?.[0]?.marks || slot.marks || 16})</div>
                             </div>
                             <!-- OR -->
                             <div class="text-center font-bold italic py-1 bg-gray-50/50 text-[9pt] border-b border-black">(OR)</div>
                             <!-- Choice 2 -->
                             <div class="flex group relative">
                                <div class="w-10 border-r border-black flex items-center justify-center font-bold text-[9pt]">b</div>
                                <div class="flex-1 px-4 py-2 relative">
                                    <AssessmentRowActions 
                                        {isEditable}
                                        onSwap={() => openSwapSidebar(slot, 'B', 'q2')}
                                        onDelete={() => removeQuestion(slot)}
                                    />
                                    {#if slot.choice2?.questions}
                                        <div class="space-y-3">
                                            {#each slot.choice2.questions as q, subIdx}
                                                <div class="flex gap-2">
                                                    {#if slot.choice2.questions.length > 1}
                                                        <span class="font-bold min-w-[20px] text-[9pt]">({subIdx === 0 ? 'i' : 'ii'})</span>
                                                    {/if}
                                                    <div class="flex-1">
                                                        <AssessmentEditable 
                                                            bind:value={q.text}
                                                            onUpdate={(v: string) => updateText(v, 'QUESTION', 'text', slot.id, q.id)}
                                                            multiline={true}
                                                            class="text-[10pt]"
                                                        />
                                                        <AssessmentMcqOptions options={q.options} />
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                                <div class="w-16 border-l border-black flex items-center justify-center font-bold text-[9pt]">({slot.choice2?.questions?.[0]?.marks || slot.marks || 16})</div>
                             </div>
                        </div>
                    {/each}
                </div>

                <!-- PART C -->
                {#if questionsC.length > 0}
                <div class="border-t-2 border-b-2 border-black py-1 text-center font-bold uppercase tracking-widest text-[10pt] mt-8">
                    PART C ({questionsC.length} X {questionsC[0]?.marks || 16} = {totalMarksC} MARKS)
                </div>
                <div class="w-full" use:dndzone={{ items: questionsC, flipDurationMs: 200 }} onconsider={(e) => handleDndSync('C', e.detail.items)} onfinalize={(e) => handleDndSync('C', e.detail.items)}>
                    {#each questionsC as slot, i (slot.id)}
                        <div animate:flip={{duration: 200}} class="border-b-2 border-black last:border-b-0 mb-4">
                             <div class="flex border-b border-black group relative">
                                <div class="w-10 border-r border-black flex items-center justify-center font-bold text-[9pt]">{questionsA.length + questionsB.length + i + 1}.a</div>
                                <div class="flex-1 px-4 py-2 relative">
                                    <AssessmentRowActions 
                                        {isEditable}
                                        onSwap={() => openSwapSidebar(slot, 'C', 'q1')}
                                        onDelete={() => removeQuestion(slot)}
                                    />
                                    {#if slot.choice1?.questions}
                                        <div class="space-y-3">
                                            {#each slot.choice1.questions as q, subIdx}
                                                <div class="flex gap-2">
                                                    {#if slot.choice1.questions.length > 1}
                                                        <span class="font-bold min-w-[20px] text-[9pt]">({subIdx === 0 ? 'i' : 'ii'})</span>
                                                    {/if}
                                                    <div class="flex-1">
                                                        <AssessmentEditable 
                                                            bind:value={q.text}
                                                            onUpdate={(v: string) => updateText(v, 'QUESTION', 'text', slot.id, q.id)}
                                                            multiline={true}
                                                            class="text-[10pt]"
                                                        />
                                                        <AssessmentMcqOptions options={q.options} />
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                                <div class="w-16 border-l border-black flex items-center justify-center font-bold text-[9pt]">({slot.choice1?.questions?.[0]?.marks || slot.marks || 8})</div>
                             </div>
                             <div class="text-center font-bold italic py-1 bg-gray-50/50 text-[9pt] border-b border-black">(OR)</div>
                             <div class="flex group relative">
                                <div class="w-10 border-r border-black flex items-center justify-center font-bold text-[9pt]">b</div>
                                <div class="flex-1 px-4 py-2 relative">
                                    <AssessmentRowActions 
                                        {isEditable}
                                        onSwap={() => openSwapSidebar(slot, 'C', 'q2')}
                                        onDelete={() => removeQuestion(slot)}
                                    />
                                    {#if slot.choice2?.questions}
                                        <div class="space-y-3">
                                            {#each slot.choice2.questions as q, subIdx}
                                                <div class="flex gap-2">
                                                    {#if slot.choice2.questions.length > 1}
                                                        <span class="font-bold min-w-[20px] text-[9pt]">({subIdx === 0 ? 'i' : 'ii'})</span>
                                                    {/if}
                                                    <div class="flex-1">
                                                        <AssessmentEditable 
                                                            bind:value={q.text}
                                                            onUpdate={(v: string) => updateText(v, 'QUESTION', 'text', slot.id, q.id)}
                                                            multiline={true}
                                                            class="text-[10pt]"
                                                        />
                                                        <AssessmentMcqOptions options={q.options} />
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                                <div class="w-16 border-l border-black flex items-center justify-center font-bold text-[9pt]">({slot.choice2?.questions?.[0]?.marks || slot.marks || 8})</div>
                             </div>
                        </div>
                    {/each}
                </div>
                {/if}
            </div>

            <!-- Signature Boxes (Exact Match) -->
            <div class="mt-20 flex justify-between px-4 gap-8">
                 <div class="border border-black p-8 flex-1 text-center font-bold text-[9pt]">
                    Name & Signature <br/> of DAAC Member
                 </div>
                 <div class="border border-black p-8 flex-1 text-center font-bold text-[9pt]">
                    Name & Signature <br/> of DAAC Member
                 </div>
            </div>

            <div class="text-center mt-8 text-[8pt] text-gray-400">***********</div>
        </div>
    </div>

    <!-- Swap Sidebar (With Dark Mode support) -->
    {#if isSwapSidebarOpen && isEditable}
         <div transition:slide={{ axis: 'x' }} class="w-96 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto no-print z-[100]">
            <div class="flex items-center justify-between mb-6">
                <h3 class="font-black text-gray-900 dark:text-white uppercase tracking-tight">SWAP QUESTION</h3>
                <button onclick={() => isSwapSidebarOpen = false} class="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            {#each swapContext?.alternates || [] as q}
                <button onclick={() => selectAlternate(q)} class="w-full text-left p-4 mb-3 bg-gray-50 dark:bg-slate-800/50 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{q.marks}M</span>
                        <span class="text-[9px] font-black text-gray-400 uppercase">{q.type || 'SHORT'}</span>
                    </div>
                    <div class="text-xs font-medium text-gray-700 dark:text-slate-300 leading-relaxed line-clamp-3">{@html q.question_text}</div>
                </button>
            {/each}
         </div>
    {/if}
</div>

<style>
    @font-face { font-family: 'Times New Roman'; font-display: swap; src: local('Times New Roman'); }
    #crescent-paper-actual { font-family: 'Times New Roman', Times, serif; }
    
    /* Ensure bold lines for Parts */
    .header-bold-border { border-top: 1.5pt solid black; border-bottom: 1.5pt solid black; }
    
    td { line-height: 1.4; vertical-align: top; }
</style>

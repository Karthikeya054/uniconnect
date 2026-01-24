<script lang="ts">
    import AssessmentRowActions from './AssessmentRowActions.svelte';
    import AssessmentEditable from './AssessmentEditable.svelte';
    import AssessmentMcqOptions from './AssessmentMcqOptions.svelte';

    let { 
        slot, 
        qNumber, 
        isEditable, 
        onSwap1, 
        onSwap2,
        onRemove, 
        onUpdateText1,
        onUpdateText2,
        snoWidth = 40,
        class: className = ""
    } = $props();

    const q1 = $derived(slot.choice1?.questions?.[0]);
    const q2 = $derived(slot.choice2?.questions?.[0]);
</script>

<div class="flex flex-col border-black {className}">
    <!-- Choice 1 Row -->
    <div class="flex divide-x-[1.5pt] divide-black min-h-[40px]">
        <div class="flex items-center justify-center font-bold text-sm tabular-nums" style="width: {snoWidth}px">
            {qNumber}.
        </div>
        <div class="flex-1 px-2 py-2 text-sm leading-relaxed relative group">
            <AssessmentRowActions 
                {isEditable}
                onSwap={onSwap1}
                onDelete={onRemove}
            />
            {#if q1}
                <AssessmentEditable 
                    bind:value={q1.text}
                    onUpdate={(v: string) => onUpdateText1(v, q1.id)}
                    multiline={true}
                />
                <AssessmentMcqOptions options={q1.options} />
            {/if}
        </div>
    </div>

    <!-- OR Row -->
    <div class="flex divide-x-[1.5pt] divide-black border-y border-black bg-gray-50/10">
         <div style="width: {snoWidth}px"></div>
         <div class="flex-1 text-center font-black uppercase text-[11px] tracking-[0.5em] py-0.5">OR</div>
    </div>

    <!-- Choice 2 Row -->
    <div class="flex divide-x-[1.5pt] divide-black min-h-[40px]">
        <div class="flex items-center justify-center font-bold text-sm tabular-nums" style="width: {snoWidth}px">
            {qNumber + 1}.
        </div>
        <div class="flex-1 px-2 py-2 text-sm leading-relaxed relative group">
            <AssessmentRowActions 
                {isEditable}
                onSwap={onSwap2}
                onDelete={onRemove}
            />
            {#if q2}
                <AssessmentEditable 
                    bind:value={q2.text}
                    onUpdate={(v: string) => onUpdateText2(v, q2.id)}
                    multiline={true}
                />
                <AssessmentMcqOptions options={q2.options} />
            {/if}
        </div>
    </div>
</div>

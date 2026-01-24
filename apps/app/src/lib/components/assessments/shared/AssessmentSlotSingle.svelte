<script lang="ts">
    import AssessmentRowActions from './AssessmentRowActions.svelte';
    import AssessmentEditable from './AssessmentEditable.svelte';
    import AssessmentMcqOptions from './AssessmentMcqOptions.svelte';

    let { 
        slot, 
        qNumber, 
        isEditable, 
        onSwap, 
        onRemove, 
        onUpdateText,
        snoWidth = 40,
        class: className = ""
    } = $props();

    const q = $derived(slot.questions?.[0] || slot);
</script>

<div class="flex divide-x-[1.5pt] divide-black min-h-[40px] {className}">
    <div class="flex items-center justify-center font-bold text-sm tabular-nums no-print print:border-none" style="width: {snoWidth}px">
        {qNumber}.
    </div>
    <div class="flex-1 px-2 py-2 text-sm leading-relaxed relative group">
        <AssessmentRowActions 
            {isEditable}
            onSwap={onSwap}
            onDelete={onRemove}
        />
        <AssessmentEditable 
            bind:value={q.text}
            onUpdate={(v) => onUpdateText(v, q.id)}
            multiline={true}
        />
        <AssessmentMcqOptions options={q.options} />
    </div>
</div>

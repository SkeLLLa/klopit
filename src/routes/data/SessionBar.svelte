<script lang="ts">
  import { Plus, Trash2 } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { SessionRecord } from '$lib/db.js';

  let {
    sessions,
    activeSessionId,
    onselect,
    oncreate,
    ondelete,
  }: {
    sessions: SessionRecord[];
    activeSessionId: string | undefined;
    onselect: (id: string) => void;
    oncreate: (year: number) => void;
    ondelete?: () => void;
  } = $props();

  let showYearInput = $state(false);
  let newYear = $state(new Date().getFullYear() - 1);

  function handleSelectChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    onselect(target.value);
  }

  function handleCreate() {
    oncreate(newYear);
    showYearInput = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') showYearInput = false;
  }
</script>

<div class="flex items-center gap-3">
  <label for="session-select" class="text-sm font-medium text-slate-700 dark:text-slate-300">
    {m.data_session_label()}
  </label>

  {#if sessions.length > 0}
    <select
      id="session-select"
      value={activeSessionId}
      onchange={handleSelectChange}
      class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
    >
      {#each sessions as session (session.id)}
        <option value={session.id}>{session.year}</option>
      {/each}
    </select>
  {/if}

  {#if showYearInput}
    <div class="flex items-center gap-2">
      <input
        type="number"
        bind:value={newYear}
        min={2000}
        max={2099}
        onkeydown={handleKeydown}
        class="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      />
      <button
        onclick={handleCreate}
        class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        {m.data_save()}
      </button>
      <button
        onclick={() => (showYearInput = false)}
        class="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
      >
        {m.data_cancel()}
      </button>
    </div>
  {:else}
    <button
      onclick={() => (showYearInput = true)}
      class="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Plus size={14} />
      {m.data_new_session()}
    </button>
  {/if}

  {#if ondelete && activeSessionId}
    <button
      onclick={ondelete}
      class="ml-auto inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      <Trash2 size={14} />
      {m.data_delete_session()}
    </button>
  {/if}
</div>

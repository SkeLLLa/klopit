<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { ImportedFileRecord } from '$lib/db.js';

  let { files }: { files: ImportedFileRecord[] } = $props();
</script>

<div class="text-xs text-slate-500 dark:text-slate-400">
  {#if files.length === 0}
    <span>{m.data_no_files()}</span>
  {:else}
    <span class="font-medium">{m.data_imported_files()}:</span>
    {#each files as file, i (file.name + file.importedAt.toString())}
      {#if i > 0}<span class="mx-1">&middot;</span>{/if}
      <span>{file.name} ({file.broker})</span>
    {/each}
  {/if}
</div>

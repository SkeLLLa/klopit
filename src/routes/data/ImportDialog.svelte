<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { importFile } from '$lib/services/import.js';
  import { supportedBrokers } from '../../core/parsers/registry.js';
  import type { BrokerId } from '../../core/types.js';

  let {
    sessionId,
    open = false,
    onclose,
  }: {
    sessionId: string;
    open: boolean;
    onclose: () => void;
  } = $props();

  const brokers = supportedBrokers();

  let dialogEl: HTMLDialogElement | undefined = $state(undefined);
  let selectedBroker: BrokerId = $state(brokers[0]?.id ?? ('ibkr' as BrokerId));
  let files: FileList | null = $state(null);
  const acceptedExtensions = $derived(
    brokers.find((b) => b.id === selectedBroker)?.fileExtensions.join(',') ?? '.csv',
  );
  let importing = $state(false);
  let results: { fileName: string; success: boolean; message: string }[] = $state([]);

  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) {
      dialogEl.showModal();
      results = [];
      files = null;
      importing = false;
    } else if (!open && dialogEl.open) {
      dialogEl.close();
    }
  });

  function handleCancel(e: Event) {
    e.preventDefault();
    onclose();
  }

  async function handleImport() {
    if (!files || files.length === 0) return;
    importing = true;
    results = [];

    for (const file of files) {
      try {
        const result = await importFile({
          sessionId,
          brokerId: selectedBroker,
          fileName: file.name,
          fileSize: file.size,
          file,
        });
        results = [
          ...results,
          {
            fileName: file.name,
            success: true,
            message: m.data_import_success({
              tradeCount: String(result.tradeCount),
              dividendCount: String(result.dividendCount),
              fileName: file.name,
            }),
          },
        ];
      } catch (err) {
        results = [
          ...results,
          {
            fileName: file.name,
            success: false,
            message: m.data_import_error({
              fileName: file.name,
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ];
      }
    }
    importing = false;
  }

  const hasResults = $derived(results.length > 0);
</script>

<dialog
  bind:this={dialogEl}
  oncancel={handleCancel}
  class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-800"
>
  <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
    {m.data_import_title()}
  </h3>

  {#if !hasResults}
    <div class="space-y-4">
      <div>
        <label
          for="broker-select"
          class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {m.data_import_broker()}
        </label>
        <select
          id="broker-select"
          bind:value={selectedBroker}
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        >
          {#each brokers as broker (broker.id)}
            <option value={broker.id}>{broker.name}</option>
          {/each}
        </select>
      </div>

      <div>
        <label
          for="file-input"
          class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {m.data_import_select_files()}
        </label>
        <input
          id="file-input"
          type="file"
          accept={acceptedExtensions}
          multiple
          onchange={(e) => {
            files = (e.target as HTMLInputElement).files;
          }}
          class="w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-slate-400 dark:file:bg-blue-900/30 dark:file:text-blue-300"
        />
        <p class="mt-1 text-xs text-slate-400">{m.data_import_drop_hint()}</p>
      </div>
    </div>

    <div class="mt-6 flex justify-end gap-3">
      <button
        onclick={onclose}
        class="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
      >
        {m.data_cancel()}
      </button>
      <button
        onclick={handleImport}
        disabled={importing || !files || files.length === 0}
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {#if importing}
          {m.data_import_processing()}
        {:else}
          {m.data_import_csv()}
        {/if}
      </button>
    </div>
  {:else}
    <div class="space-y-2">
      {#each results as result (result.fileName)}
        <div
          class="rounded-md p-3 text-sm {result.success
            ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
            : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'}"
        >
          {result.message}
        </div>
      {/each}
    </div>
    <div class="mt-6 flex justify-end">
      <button
        onclick={onclose}
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {m.data_import_done()}
      </button>
    </div>
  {/if}
</dialog>

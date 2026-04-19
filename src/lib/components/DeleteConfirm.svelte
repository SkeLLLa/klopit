<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';

  let {
    message,
    open = false,
    onconfirm,
    oncancel,
  }: {
    message: string;
    open: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();

  let dialogEl: HTMLDialogElement | undefined = $state(undefined);

  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) {
      dialogEl.showModal();
    } else if (!open && dialogEl.open) {
      dialogEl.close();
    }
  });

  function handleCancel(e: Event) {
    e.preventDefault();
    oncancel();
  }
</script>

<dialog
  bind:this={dialogEl}
  oncancel={handleCancel}
  class="m-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-lg backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-800"
>
  <p class="mb-6 text-sm text-slate-700 dark:text-slate-300">{message}</p>
  <div class="flex justify-end gap-3">
    <button
      onclick={oncancel}
      class="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
    >
      {m.data_cancel()}
    </button>
    <button
      onclick={onconfirm}
      class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
    >
      {m.data_confirm()}
    </button>
  </div>
</dialog>

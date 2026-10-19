<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { formatAccount, manualAccount } from '$lib/utils/account.js';

  let {
    id,
    accounts,
    value,
    onchange,
    compact = false,
  }: {
    id: string;
    /** Distinct accounts already present in the session. */
    accounts: string[];
    value: string | undefined;
    onchange: (value: string | undefined) => void;
    compact?: boolean;
  } = $props();

  const NEW = '__new__';

  let creating = $state(false);
  let label = $state('');

  // A seed outside the known list (e.g. a freshly typed manual account) is
  // kept selectable.
  const options = $derived(
    !creating && value && !accounts.includes(value)
      ? [...accounts, value]
      : accounts,
  );

  function handleSelect(event: Event) {
    const selected = (event.currentTarget as HTMLSelectElement).value;
    creating = selected === NEW;
    onchange(
      creating ? manualAccount(label, accounts) : selected || undefined,
    );
  }

  function handleLabel() {
    onchange(manualAccount(label, accounts));
  }

  const inputClass = $derived(
    compact
      ? 'rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
      : 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  );
</script>

  <div class="flex flex-col gap-1">
    <select {id} aria-label={m.data_account()} value={creating ? NEW : (value ?? '')} onchange={handleSelect} class={inputClass}>
      {#if accounts.length !== 1}<option value="">—</option>{/if}
      {#each options as account (account)}
        <option value={account}>{formatAccount(account)}</option>
      {/each}
      <option value={NEW}>{m.data_account_new()}</option>
    </select>
    {#if creating}
      <input type="text" aria-label={m.data_account_label()} placeholder={m.data_account_label()} bind:value={label} oninput={handleLabel} class={inputClass} />
    {/if}
  </div>

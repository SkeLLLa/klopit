<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { formatAccount, manualAccount } from '$lib/utils/account.js';

  let {
    id,
    accounts,
    value = $bindable(),
    compact = false,
  }: {
    id: string;
    /** Distinct accounts already present in the session. */
    accounts: string[];
    value: string | undefined;
    compact?: boolean;
  } = $props();

  const NEW = '__new__';

  // A seed outside the known list (e.g. a freshly typed manual account) is
  // kept selectable.
  const options = $derived(
    value && !accounts.includes(value) ? [...accounts, value] : accounts,
  );
  let creating = $state(false);
  let label = $state('');

  function handleSelect(event: Event) {
    const selected = (event.currentTarget as HTMLSelectElement).value;
    creating = selected === NEW;
    value = creating ? manualAccount(label) : selected || undefined;
  }

  function handleLabel() {
    value = manualAccount(label);
  }

  const inputClass = $derived(
    compact
      ? 'rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
      : 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  );
</script>

{#if accounts.length > 1 || (value && !accounts.includes(value))}
  <div class="flex flex-col gap-1">
    <select {id} aria-label={m.data_account()} value={creating ? NEW : (value ?? '')} onchange={handleSelect} class={inputClass}>
      <option value="">—</option>
      {#each options as account (account)}
        <option value={account}>{formatAccount(account)}</option>
      {/each}
      <option value={NEW}>{m.data_account_new()}</option>
    </select>
    {#if creating}
      <input type="text" aria-label={m.data_account_label()} placeholder={m.data_account_label()} bind:value={label} oninput={handleLabel} class={inputClass} />
    {/if}
  </div>
{/if}

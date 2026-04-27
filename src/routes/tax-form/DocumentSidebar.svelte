<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import {
    FileText,
    Folder,
    ChevronRight,
    ChevronDown,
    MapPin,
  } from 'lucide-svelte';

  type ActiveDocument = 'pit38' | { pitZg: string };

  let {
    countries,
    activeDocument,
    onselect,
  }: {
    countries: string[];
    activeDocument: ActiveDocument;
    onselect: (doc: ActiveDocument) => void;
  } = $props();

  let pitZgExpanded = $state(true);

  function isActive(doc: ActiveDocument): boolean {
    if (typeof activeDocument === 'string' && typeof doc === 'string') {
      return activeDocument === doc;
    }
    if (typeof activeDocument === 'object' && typeof doc === 'object') {
      return activeDocument.pitZg === doc.pitZg;
    }
    return false;
  }

  const hasPitZg = $derived(countries.length > 0);
</script>

<!-- Desktop sidebar -->
<nav class="hidden w-56 shrink-0 lg:block">
  <div class="space-y-0.5 text-sm">
    <!-- Tax reports root -->
    <button
      class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
      onclick={() => onselect('pit38')}
    >
      <Folder size={16} class="text-slate-400" />
      {m.tax_sidebar_tax_reports()}
    </button>

    <!-- PIT-38 -->
    <button
      class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 pl-6 text-left {isActive('pit38') ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}"
      onclick={() => onselect('pit38')}
    >
      <FileText size={14} />
      PIT-38
    </button>

    <!-- PIT/ZG parent -->
    {#if hasPitZg}
      <button
        class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 pl-6 text-left text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
        onclick={() => (pitZgExpanded = !pitZgExpanded)}
      >
        {#if pitZgExpanded}
          <ChevronDown size={14} />
        {:else}
          <ChevronRight size={14} />
        {/if}
        {m.tax_sidebar_pitzg()}
      </button>

      <!-- Country children -->
      {#if pitZgExpanded}
        {#each countries as country (country)}
          <button
            class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 pl-12 text-left {isActive({ pitZg: country }) ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}"
            onclick={() => onselect({ pitZg: country })}
          >
            <FileText size={14} />
            {country}
          </button>
        {/each}
      {/if}
    {/if}
  </div>

  <!-- Country mapping link -->
  <div class="mt-3 border-t border-slate-200 pt-3 dark:border-slate-600">
    <a
      href="/data"
      class="flex items-center gap-1.5 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
    >
      <MapPin size={12} />
      {m.tax_sidebar_country_mapping()}
    </a>
  </div>
</nav>

<!-- Mobile dropdown -->
<div class="mb-4 lg:hidden">
  <select
    class="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
    value={typeof activeDocument === 'string' ? 'pit38' : `pitzg:${activeDocument.pitZg}`}
    onchange={(e) => {
      const val = e.currentTarget.value;
      if (val === 'pit38') {
        onselect('pit38');
      } else {
        onselect({ pitZg: val.replace('pitzg:', '') });
      }
    }}
  >
    <option value="pit38">PIT-38</option>
    {#each countries as country (country)}
      <option value="pitzg:{country}">PIT/ZG — {country}</option>
    {/each}
  </select>
</div>

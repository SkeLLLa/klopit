<script lang="ts">
  import { PanelLeftClose, PanelLeft } from 'lucide-svelte';
  import { sidebar } from '$lib/state/sidebar.svelte.js';
  import { navigation } from '$lib/nav.js';
  import Logo from '../ui/Logo.svelte';
  import NavGroup from '../ui/NavGroup.svelte';
  import LanguagePicker from '../ui/LanguagePicker.svelte';
</script>

<!-- Mobile overlay backdrop -->
{#if sidebar.mobileOpen}
  <button
    class="fixed inset-0 z-40 bg-black/50 md:hidden"
    onclick={sidebar.closeMobile}
    aria-label="Close menu"
    tabindex="-1"
  ></button>
{/if}

<aside
  data-sidebar
  class="fixed z-50 flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
  style:width={sidebar.collapsed ? '3.5rem' : '15rem'}
  style:transform={sidebar.mobileOpen ? 'translateX(0)' : undefined}
  aria-label="Main navigation"
>
  <!-- Logo -->
  <div class="overflow-hidden border-b border-slate-200 p-4 dark:border-slate-800">
    <Logo collapsed={sidebar.collapsed} />
  </div>

  <!-- Collapse toggle (sits on the right border between sidebar and main content) -->
  <button
    class="absolute right-0 top-0 z-10 hidden h-6 w-6 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:text-slate-300 md:flex"
    onclick={sidebar.toggleCollapsed}
    aria-label={sidebar.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  >
    {#if sidebar.collapsed}
      <PanelLeft size={12} />
    {:else}
      <PanelLeftClose size={12} />
    {/if}
  </button>

  <!-- Navigation -->
  <nav class="flex-1 overflow-y-auto p-2">
    {#each navigation as section, i (section.labelKey)}
      {#if i > 0}
        <div class="mx-1 my-2.5 border-t border-slate-200 dark:border-slate-800"></div>
      {/if}
      <NavGroup {section} />
    {/each}
  </nav>

  <!-- Language picker -->
  <div class="border-t border-slate-200 p-3 dark:border-slate-800">
    <LanguagePicker collapsed={sidebar.collapsed} />
  </div>
</aside>

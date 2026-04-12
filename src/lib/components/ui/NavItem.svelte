<script lang="ts">
  import {
    House,
    FolderOpen,
    FileText,
    Table,
    BarChart3,
    Heart,
    Info,
    ArrowLeftRight,
    ChevronDown,
  } from 'lucide-svelte';
  const iconMap: Record<string, typeof House> = {
    House,
    FolderOpen,
    FileText,
    Table,
    BarChart3,
    Heart,
    Info,
    ArrowLeftRight,
  };

  let {
    href,
    label,
    iconName,
    active = false,
    collapsed = false,
    hasChildren = false,
    expanded = false,
    onclick,
  }: {
    href: string;
    label: string;
    iconName: string;
    active?: boolean;
    collapsed?: boolean;
    hasChildren?: boolean;
    expanded?: boolean;
    onclick?: (e: MouseEvent) => void;
  } = $props();

  const IconComponent = $derived(iconMap[iconName]);
</script>

{#if hasChildren}
  <button
    class="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-xs transition-colors
      {active
        ? 'border-l-3 border-emerald-500 bg-emerald-50 font-medium text-emerald-600 dark:border-emerald-400 dark:bg-emerald-500/12 dark:text-emerald-400'
        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'}"
    {onclick}
  >
    {#if IconComponent}
      <IconComponent size={16} class="shrink-0" />
    {/if}
    {#if !collapsed}
      <span class="flex-1 text-left">{label}</span>
      <ChevronDown size={12} class="shrink-0 transition-transform {expanded ? 'rotate-180' : ''}" />
    {/if}
  </button>
{:else}
  <a
    {href}
    class="flex items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-xs transition-colors
      {active
        ? 'border-l-3 border-emerald-500 bg-emerald-50 font-medium text-emerald-600 dark:border-emerald-400 dark:bg-emerald-500/12 dark:text-emerald-400'
        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'}"
    aria-current={active ? 'page' : undefined}
  >
    {#if IconComponent}
      <IconComponent size={16} class="shrink-0" />
    {/if}
    {#if !collapsed}
      <span>{label}</span>
    {/if}
  </a>
{/if}

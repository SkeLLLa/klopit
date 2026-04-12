<script lang="ts">
  import { page } from '$app/state';
  import { localizeHref } from '$lib/paraglide/runtime';
  import type { NavSection } from '$lib/nav.js';
  import { m } from '$lib/paraglide/messages.js';
  import NavItem from './NavItem.svelte';
  import { sidebar } from '$lib/state/sidebar.svelte.js';

  let { section }: { section: NavSection } = $props();

  const currentPath = $derived(page.url.pathname);
  let expandedItems = $state<Record<string, boolean>>({});

  function t(key: string): string {
    return (m as Record<string, (...args: unknown[]) => string>)[key]?.() ?? key;
  }

  function isActive(href: string): boolean {
    if (href === '/') return currentPath === '/' || currentPath === localizeHref('/');
    return currentPath.startsWith(localizeHref(href));
  }

  function toggleExpand(key: string) {
    expandedItems[key] = !expandedItems[key];
  }
</script>

{#if !sidebar.collapsed}
  <div class="mb-1.5 px-2 text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
    {t(section.labelKey)}
  </div>
{/if}

{#each section.items as item (item.labelKey)}
  <NavItem
    href={item.children
      ? sidebar.collapsed
        ? localizeHref(item.href)
        : '#'
      : localizeHref(item.href)}
    label={t(item.labelKey)}
    iconName={item.icon}
    active={isActive(item.href)}
    collapsed={sidebar.collapsed}
    hasChildren={!sidebar.collapsed && !!item.children}
    expanded={!!expandedItems[item.labelKey]}
    onclick={!sidebar.collapsed && item.children ? () => toggleExpand(item.labelKey) : undefined}
  />

  {#if item.children && expandedItems[item.labelKey] && !sidebar.collapsed}
    <div class="mb-0.5 pl-7">
      {#each item.children as child (child.labelKey)}
        <a
          href={localizeHref(child.href)}
          class="block rounded-md px-2.5 py-1.5 text-[11px] transition-colors
            {isActive(child.href)
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}"
        >
          {t(child.labelKey)}
        </a>
      {/each}
      <span class="block px-2.5 py-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        {t('nav_docs_more')}
      </span>
    </div>
  {/if}
{/each}

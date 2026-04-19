<script lang="ts">
  import { Menu } from 'lucide-svelte';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { sidebar } from '$lib/state/sidebar.svelte.js';
  import ThemeToggle from '../ui/ThemeToggle.svelte';
  import Logo from '../ui/Logo.svelte';
</script>

<header
  class="flex h-[52px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900"
>
  <!-- Mobile: hamburger + logo -->
  <div class="flex items-center gap-3 md:hidden">
    <button onclick={sidebar.toggleMobile} class="text-slate-500" aria-label="Toggle menu">
      <Menu size={20} />
    </button>
    <Logo />
  </div>

  <!-- Desktop: page title (not an h1 — each route owns its heading) -->
  <p class="hidden text-sm font-semibold text-slate-900 dark:text-slate-100 md:block">
    {pageTitle.title}
  </p>

  <ThemeToggle />
</header>

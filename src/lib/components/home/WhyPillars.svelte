<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { DollarSign, Globe, GitFork, UserX } from 'lucide-svelte';

  const pillars = [
    { icon: DollarSign, label: m.home_why_free_label(), desc: m.home_why_free_desc() },
    { icon: Globe, label: m.home_why_online_label(), desc: m.home_why_online_desc() },
    { icon: GitFork, label: m.home_why_oss_label(), desc: m.home_why_oss_desc() },
    { icon: UserX, label: m.home_why_nosignup_label(), desc: m.home_why_nosignup_desc() },
  ];
</script>

<section aria-label="Why kloPIT" class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
  {#each pillars as p (p.label)}
    <div class="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-white/[0.03]">
      <div class="mb-1.5 flex items-center gap-2">
        <div class="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-500/12">
          <p.icon size={12} class="text-emerald-500 dark:text-emerald-400" />
        </div>
        <span class="text-xs font-semibold text-slate-900 dark:text-slate-100">{p.label}</span>
      </div>
      <p class="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{p.desc}</p>
    </div>
  {/each}
</section>

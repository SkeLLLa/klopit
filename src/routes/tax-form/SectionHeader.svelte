<script lang="ts">
  let {
    title,
    placeholder = false,
  }: {
    title: string;
    placeholder?: boolean;
  } = $props();
</script>

<div
  class="mb-3 border-b border-slate-200 pb-2 dark:border-slate-700"
  class:opacity-50={placeholder}
>
  <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
    {title}
  </h3>
</div>

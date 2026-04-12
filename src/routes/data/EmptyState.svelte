<script lang="ts">
  let { message }: { message: string } = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center">
  <p class="text-sm text-slate-500 dark:text-slate-400">{message}</p>
</div>

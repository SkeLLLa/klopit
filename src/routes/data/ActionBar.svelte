<script lang="ts">
  import ImportPanel from './ImportPanel.svelte';

  let {
    sessionId,
  }: {
    sessionId: string;
  } = $props();
</script>

<ImportPanel {sessionId} />

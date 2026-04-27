<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import FormField from './FormField.svelte';
  import SectionHeader from './SectionHeader.svelte';
</script>

<section class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
  <SectionHeader title={m.tax_section_a()} />

  <div class="space-y-1">
    <FormField
      label={m.tax_a_submission_purpose()}
      poz={6}
      value={m.tax_a_submission_purpose_value()}
    />
  </div>
</section>

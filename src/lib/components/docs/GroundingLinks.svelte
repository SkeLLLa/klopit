<script lang="ts">
  import GroundingLink from './GroundingLink.svelte';
  import type { GroundingSource } from './grounding';

  interface Props {
    sources: GroundingSource[];
    keys?: string[];
    variant?: 'inline' | 'list';
    labelledBy?: string;
    class?: string;
  }

  let {
    sources,
    keys,
    variant = 'inline',
    labelledBy,
    class: className = '',
  }: Props = $props();

  const sourceByKey = (key: string) => sources.find((source) => source.key === key);

  const sourceNumber = (source: GroundingSource) =>
    sources.findIndex((candidate) => candidate.key === source.key) + 1;

  const selectedSources = $derived(
    keys
      ? keys
          .map(sourceByKey)
          .filter((source): source is GroundingSource => source !== undefined)
      : sources
  );

  const wrapperClass = $derived(
    variant === 'inline'
      ? `ml-1 inline-flex max-w-full flex-wrap items-center gap-1 align-baseline text-[0.72rem] leading-none ${className}`
      : `grid gap-2 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-300 ${className}`
  );

  const ariaLabel = (source: GroundingSource) => {
    const quote = source.quote ? `. Quote: ${source.quote}` : '';
    return `Source ${sourceNumber(source)}: ${source.label}${quote}`;
  };
</script>

{#if variant === 'inline'}
  <span class={wrapperClass}>
    {#each selectedSources as source (source.key)}
      <GroundingLink
        href={source.href}
        label={source.label}
        quote={source.quote}
        number={sourceNumber(source)}
        variant="inlineCitation"
        ariaLabel={ariaLabel(source)}
      />
    {/each}
  </span>
{:else}
  <ul class={wrapperClass} aria-labelledby={labelledBy}>
    {#each selectedSources as source (source.key)}
      <li>
        <GroundingLink
          href={source.href}
          label={source.label}
          quote={source.quote}
          number={sourceNumber(source)}
          variant="sourceTile"
          ariaLabel={ariaLabel(source)}
        />
      </li>
    {/each}
  </ul>
{/if}

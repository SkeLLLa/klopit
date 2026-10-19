export interface GroundingSource {
  key: string;
  label: string;
  href: string;
  quote?: string | undefined;
}

export type GroundingLinkVariant =
  | 'inlineCitation'
  | 'sourceTile'
  | 'inlineText';

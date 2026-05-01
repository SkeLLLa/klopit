export interface GroundingSource {
  key: string;
  label: string;
  href: string;
  quote?: string;
}

export type GroundingLinkVariant =
  | 'inlineCitation'
  | 'sourceTile'
  | 'inlineText';

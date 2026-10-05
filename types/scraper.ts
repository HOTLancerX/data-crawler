export type FieldType =
  | 'text'
  | 'html'
  | 'image_url'
  | 'first_image_url'
  | 'image_list'
  | 'first_image_tag'
  | 'gallery_remaining'
  | 'image_tag'
  | 'link_url'
  | 'link_list'
  | 'attribute'
  | 'array_text'
  | 'number';

export interface DynamicField {
  id: string;
  name: string;
  xpath: string;
  type: FieldType;
  attributeName?: string;
  imgTagClass?: string;
  excludeFirstImage?: boolean;
  highResImages?: boolean;
  companionMainImageTag?: boolean;
  sampleResult?: any;
  error?: string;
  required?: boolean;
}

export interface UrlItem {
  id: string;
  url: string;
  selected: boolean;
  status: 'idle' | 'pending' | 'scraping' | 'success' | 'error';
  data?: Record<string, any>;
  error?: string;
  durationMs?: number;
}

export interface SitemapResult {
  url: string;
  isIndex: boolean;
  urls: string[];
  subSitemaps: string[];
}

export type ScraperStep = 1 | 2 | 3 | 4;

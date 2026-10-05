import { DynamicField } from '@/plugin/data-crawler/types/scraper';

export interface FieldPreset {
  id: string;
  name: string;
  description: string;
  fields: DynamicField[];
}

export const PRESETS: FieldPreset[] = [
  {
    id: 'avechi-sample',
    name: 'Avechi Product (User Example)',
    description: 'Extracts "image" URL from 1st gallery image, while gallery excludes that image',
    fields: [
      {
        id: 'f1',
        name: 'title',
        xpath: '//*[@id="product-17379"]/div[2]/h1 | //div[contains(@class, "summary")]/h1 | //h1[contains(@class, "product_title")] | //h1',
        type: 'text',
      },
      {
        id: 'f2',
        name: 'image',
        xpath: '//*[@id="product-17379"]/div[1]/ol | //ol[contains(@class, "flex-control-thumbs")] | //div[contains(@class, "woocommerce-product-gallery")]',
        type: 'first_image_url', // Extracts clean direct URL: "image": "https://avechi.co.ke/wp-content/uploads/2022/08/3.jpg"
      },
      {
        id: 'f3',
        name: 'gallery',
        xpath: '//*[@id="product-17379"]/div[1]/ol | //ol[contains(@class, "flex-control-thumbs")] | //div[contains(@class, "woocommerce-product-gallery")]',
        type: 'image_list',
        excludeFirstImage: true, // Ensures gallery does not contain that first image!
      },
      {
        id: 'f4',
        name: 'price',
        xpath: '//p[contains(@class, "price")]//span[contains(@class, "woocommerce-Price-amount")] | //span[contains(@class, "price")]',
        type: 'text',
      },
      {
        id: 'f5',
        name: 'description',
        xpath: '//div[contains(@class, "woocommerce-product-details__short-description")] | //div[@id="tab-description"]',
        type: 'text',
      },
    ],
  },
  {
    id: 'woocommerce-generic',
    name: 'WooCommerce / Shopify Store',
    description: 'Universal e-commerce fields for title, price, galleries, SKU, and description',
    fields: [
      {
        id: 'w1',
        name: 'title',
        xpath: '//h1[contains(@class, "product_title")] | //h1[contains(@class, "product-title")] | //h1',
        type: 'text',
      },
      {
        id: 'w2',
        name: 'gallery_images',
        xpath: '//div[contains(@class, "woocommerce-product-gallery")] | //ol[contains(@class, "flex-control-thumbs")] | //div[contains(@class, "product-images")]',
        type: 'image_list',
      },
      {
        id: 'w3',
        name: 'main_image',
        xpath: '//div[contains(@class, "woocommerce-product-gallery__image")]//img | //img[contains(@class, "wp-post-image")]',
        type: 'image_url',
      },
      {
        id: 'w4',
        name: 'price',
        xpath: '//p[contains(@class, "price")]//bdi | //span[contains(@class, "price")]',
        type: 'text',
      },
      {
        id: 'w5',
        name: 'sku',
        xpath: '//span[contains(@class, "sku")]',
        type: 'text',
      },
      {
        id: 'w6',
        name: 'availability',
        xpath: '//p[contains(@class, "stock")]',
        type: 'text',
      },
    ],
  },
  {
    id: 'blog-article',
    name: 'Blog / Article Extractor',
    description: 'Extract headline, author, date, feature image, and article paragraphs',
    fields: [
      {
        id: 'b1',
        name: 'headline',
        xpath: '//h1',
        type: 'text',
      },
      {
        id: 'b2',
        name: 'author',
        xpath: '//*[contains(@class, "author")] | //meta[@name="author"]',
        type: 'text',
      },
      {
        id: 'b3',
        name: 'publish_date',
        xpath: '//time | //meta[@property="article:published_time"]',
        type: 'text',
      },
      {
        id: 'b4',
        name: 'featured_image',
        xpath: '//article//img | //div[contains(@class, "featured")]//img | //meta[@property="og:image"]',
        type: 'image_url',
      },
      {
        id: 'b5',
        name: 'article_body',
        xpath: '//article | //div[contains(@class, "entry-content")] | //div[contains(@class, "post-content")]',
        type: 'text',
      },
    ],
  },
];

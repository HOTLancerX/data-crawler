'use client';

import React, { useState } from 'react';
import StepperHeader from '@/plugin/data-crawler/components/StepperHeader';
import Step1Sitemap from '@/plugin/data-crawler/components/Step1Sitemap';
import Step2UrlList from '@/plugin/data-crawler/components/Step2UrlList';
import Step3XPathConfig from '@/plugin/data-crawler/components/Step3XPathConfig';
import Step4ScrapeResults from '@/plugin/data-crawler/components/Step4ScrapeResults';
import { DynamicField, ScraperStep, UrlItem } from '@/plugin/data-crawler/types/scraper';
import { PRESETS } from '@/plugin/data-crawler/lib/presets';
import { Icon } from '@iconify/react';

export default function DataCrawlerAdminPage() {
  const [currentStep, setCurrentStep] = useState<ScraperStep>(1);
  const [sitemapUrl, setSitemapUrl] = useState<string>('https://avechi.co.ke/product-sitemap2.xml');
  const [sitemapSource, setSitemapSource] = useState<string>('https://avechi.co.ke/product-sitemap2.xml');
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [isLoadingSitemap, setIsLoadingSitemap] = useState<boolean>(false);

  // Initial fields loaded from user's Avechi preset
  const [fields, setFields] = useState<DynamicField[]>(() => {
    const avechiPreset = PRESETS[0];
    return avechiPreset ? avechiPreset.fields : [];
  });

  // When sitemap URLs are successfully loaded in Step 1
  const handleSitemapLoaded = (loadedUrls: string[], source: string) => {
    setSitemapSource(source);
    const newItems: UrlItem[] = loadedUrls.map((url, idx) => ({
      id: `url-${idx}-${Date.now()}`,
      url,
      selected: true, // All options selected by default
      status: 'idle',
    }));
    setUrls(newItems);
    setCurrentStep(2);
  };

  const selectedUrls = urls.filter((u) => u.selected);

  // Can user jump to a specific step?
  const canNavigateTo = (targetStep: ScraperStep): boolean => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return urls.length > 0;
    if (targetStep === 3) return selectedUrls.length > 0;
    if (targetStep === 4) return selectedUrls.length > 0 && fields.length > 0;
    return false;
  };

  const handleStepClick = (targetStep: ScraperStep) => {
    if (canNavigateTo(targetStep)) {
      setCurrentStep(targetStep);
    }
  };

  const handleResetAll = () => {
    setCurrentStep(1);
    setUrls([]);
  };

  return (
    <div className="min-h-screen">
      {/* Main Content Area */}
      <main className="container">
        {/* Stepper Navigation */}
        <StepperHeader
          currentStep={currentStep}
          onStepClick={handleStepClick}
          canNavigateTo={canNavigateTo}
          selectedUrlCount={selectedUrls.length}
          totalUrlCount={urls.length}
          fieldsCount={fields.length}
        />

        {/* Step 1: Sitemap URL Input */}
        {currentStep === 1 && (
          <Step1Sitemap
            sitemapUrl={sitemapUrl}
            setSitemapUrl={setSitemapUrl}
            onSitemapLoaded={handleSitemapLoaded}
            isLoading={isLoadingSitemap}
            setIsLoading={setIsLoadingSitemap}
          />
        )}

        {/* Step 2: URL Selection List */}
        {currentStep === 2 && (
          <Step2UrlList
            urls={urls}
            setUrls={setUrls}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
            sitemapSource={sitemapSource}
          />
        )}

        {/* Step 3: Dynamic XPath Fields Configuration */}
        {currentStep === 3 && (
          <Step3XPathConfig
            fields={fields}
            setFields={setFields}
            selectedUrls={selectedUrls}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {/* Step 4: Batch Scraping & JSON Results */}
        {currentStep === 4 && (
          <Step4ScrapeResults
            selectedUrls={selectedUrls}
            fields={fields}
            onBackToStep3={() => setCurrentStep(3)}
            onResetAll={handleResetAll}
          />
        )}
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import { Icon } from '@iconify/react';
import { ScraperStep } from '@/plugin/data-crawler/types/scraper';

interface StepperHeaderProps {
  currentStep: ScraperStep;
  onStepClick: (step: ScraperStep) => void;
  canNavigateTo: (step: ScraperStep) => boolean;
  selectedUrlCount: number;
  totalUrlCount: number;
  fieldsCount: number;
}

export default function StepperHeader({
  currentStep,
  onStepClick,
  canNavigateTo,
  selectedUrlCount,
  fieldsCount,
}: StepperHeaderProps) {
  const steps = [
    {
      step: 1 as ScraperStep,
      title: 'Step 1',
      subtitle: 'Sitemap URL',
      icon: 'solar:link-circle-bold',
      badge: null,
    },
    {
      step: 2 as ScraperStep,
      title: 'Step 2',
      subtitle: 'Select URLs',
      icon: 'solar:checklist-minimalistic-bold',
      badge: selectedUrlCount > 0 ? `${selectedUrlCount} selected` : null,
    },
    {
      step: 3 as ScraperStep,
      title: 'Step 3',
      subtitle: 'Dynamic XPath Fields',
      icon: 'solar:code-square-bold',
      badge: fieldsCount > 0 ? `${fieldsCount} fields` : null,
    },
    {
      step: 4 as ScraperStep,
      title: 'Step 4',
      subtitle: 'JSON Results',
      icon: 'solar:database-bold',
      badge: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative mb-4">
      {steps.map((s) => {
        const isCurrent = currentStep === s.step;
        const isDone = currentStep > s.step;
        const isClickable = canNavigateTo(s.step);

        return (
          <button
            key={s.step}
            type="button"
            disabled={!isClickable && !isCurrent}
            onClick={() => onStepClick(s.step)}
            className={`flex items-center gap-3.5 p-3 rounded-xl transition-all text-left relative group ${
              isCurrent
                ? 'bg-blue-50/80 dark:bg-blue-950/30 border border-blue-500/50 shadow-sm'
                : isDone
                ? 'bg-gray-50 dark:bg-gray-800/60 border border-emerald-500/40 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                : isClickable
                ? 'bg-gray-50/60 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 cursor-pointer'
                : 'bg-gray-50/30 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold transition-all ${
                isCurrent
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : isDone
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 group-hover:text-gray-700'
              }`}
            >
              {isDone ? (
                <Icon icon="solar:check-read-bold" className="w-5 h-5" />
              ) : (
                <Icon icon={s.icon} className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-semibold tracking-wider uppercase ${
                    isCurrent
                      ? 'text-blue-600 dark:text-blue-400'
                      : isDone
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {s.title}
                </span>
                {s.badge && (
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                    {s.badge}
                  </span>
                )}
              </div>
              <div
                className={`text-sm font-semibold truncate ${
                  isCurrent
                    ? 'text-gray-900 dark:text-white'
                    : isDone
                    ? 'text-gray-800 dark:text-gray-200'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {s.subtitle}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

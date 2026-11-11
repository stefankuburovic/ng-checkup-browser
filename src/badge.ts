import type { PageReport } from './types.js';

/** The report's own palette (light theme), since a badge has one colour in every theme. */
const COLOURS = { good: '#1f7a4d', fair: '#8a5a00', poor: '#b42318' } as const;

export interface Badge {
  text: string;
  colour?: string;
  title: string;
}

/**
 * The toolbar badge for a report: the Angular major (or 1.x for AngularJS) as
 * the fact, the verdict as the colour, and the verdict in words in the title,
 * since a badge holds four characters and no shape.
 */
export function badgeFor(report: PageReport): Badge {
  const { verdict } = report;
  if (verdict.kind === 'none') return { text: '', title: 'ng-checkup: no Angular found on this page' };
  if (verdict.kind === 'other') return { text: '', title: `ng-checkup: not an Angular app (${verdict.sub})` };

  const angularJs = report.frameworks.some((framework) => framework.name === 'AngularJS');
  const major = report.angular?.version?.split('.')[0];
  const gap = major ? report.latestMajor - Number(major) : undefined;
  const text = angularJs ? '1.x' : (major ?? 'ng');
  const highs = report.findings.filter((finding) => finding.severity === 'high').length;
  const colour = angularJs || (gap !== undefined && gap >= 3) || verdict.level === 'high' ? COLOURS.poor : gap === 2 || verdict.level === 'medium' ? COLOURS.fair : COLOURS.good;
  const title = `ng-checkup: ${verdict.title}, ${verdict.word.toLowerCase()}${highs > 0 ? ` · ${highs} high ${highs === 1 ? 'finding' : 'findings'}` : ''}`;
  return { text, colour, title };
}

/** Shows the badge on one tab; the worker clears it when the tab navigates. */
export async function showBadge(tabId: number, report: PageReport): Promise<void> {
  const badge = badgeFor(report);
  await chrome.action.setBadgeText({ tabId, text: badge.text });
  if (badge.colour) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.colour });
    await chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' });
  }
  await chrome.action.setTitle({ tabId, title: badge.title });
}

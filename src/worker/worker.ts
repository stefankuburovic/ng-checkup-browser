import { reportKey } from '../keys.js';

/**
 * The service worker keeps nothing of its own in 0.1: it only forgets a tab's
 * report and badge when the tab goes to another page or closes, so neither
 * ever describes a page that is no longer there.
 */
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status !== 'loading') return;
  void chrome.storage.session.remove(reportKey(tabId));
  void chrome.action.setBadgeText({ tabId, text: '' });
  void chrome.action.setTitle({ tabId, title: 'ng-checkup: check this page' });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(reportKey(tabId));
});

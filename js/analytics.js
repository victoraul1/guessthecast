const Analytics = (() => {
  const measurementId = 'G-E9H2E6R0XK';
  const storageKey = 'gtc_analytics_consent';
  let loaded = false;

  function getChoice() {
    try { return window.localStorage.getItem(storageKey); }
    catch (_) { return null; }
  }

  function saveChoice(choice) {
    try { window.localStorage.setItem(storageKey, choice); }
    catch (_) { /* The selection still applies for this page view. */ }
  }

  function loadGoogleAnalytics() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { anonymize_ip: true });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }

  function track(eventName, parameters = {}) {
    if (getChoice() !== 'accepted' || typeof window.gtag !== 'function') return;
    window.gtag('event', eventName, parameters);
  }

  function showBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.hidden = false;
  }

  function hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.hidden = true;
  }

  function accept() {
    saveChoice('accepted');
    if (loaded && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    } else {
      loadGoogleAnalytics();
    }
    hideBanner();
  }

  function decline() {
    saveChoice('declined');
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (name === '_ga' || name.startsWith('_ga_')) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    });
    hideBanner();
  }

  function init() {
    const choice = getChoice();
    if (choice === 'accepted') loadGoogleAnalytics();
    else if (choice !== 'declined') showBanner();

    document.getElementById('cookie-accept').addEventListener('click', accept);
    document.getElementById('cookie-decline').addEventListener('click', decline);
    document.getElementById('cookie-settings').addEventListener('click', showBanner);
  }

  return { init, track };
})();

window.Analytics = Analytics;
document.addEventListener('DOMContentLoaded', Analytics.init);

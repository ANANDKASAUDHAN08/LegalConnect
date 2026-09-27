import { ICON_REGISTRY } from '../components/icon/icon.registry';
import { IconName } from '../components/icon/icon.types';

/**
 * Renders an inline SVG icon utilizing our custom-made SVG icon registry (ICON_REGISTRY),
 * perfectly matching the structure, viewBox, and sizing of <app-icon>.
 */
export function getCustomIconHtml(
  name: IconName,
  options: {
    colorClass?: string;
    size?: number | string;
    extraClass?: string;
  } = {}
): string {
  const { colorClass = '', size = 16, extraClass = '' } = options;
  let rawSvg = ICON_REGISTRY[name] || ICON_REGISTRY['help-circle'] || '';

  // Ensure svg has 100% width and height so parent span controls dimensions identically to <app-icon>
  if (!rawSvg.includes('width=')) {
    rawSvg = rawSvg.replace('<svg', '<svg width="100%" height="100%"');
  }

  const sizePx = typeof size === 'number' ? `${size}px` : size;

  return `<span class="inline-flex items-center justify-center align-middle flex-shrink-0 leading-none ${colorClass} ${extraClass}" style="width:${sizePx};height:${sizePx};min-width:${sizePx};min-height:${sizePx};vertical-align:-0.15em;" aria-hidden="true">${rawSvg}</span>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts unicode emojis in notification, announcement, or message strings into
 * our custom-made SVG components from ICON_REGISTRY.
 * Safely escapes all HTML characters first to ensure zero XSS risk when rendered via [innerHTML].
 */
export function replaceEmojisWithSvg(text: string): string {
  if (!text) return '';

  const safeText = escapeHtml(text);

  return safeText
    // Rocket 🚀
    .replace(/🚀/g, getCustomIconHtml('rocket', { colorClass: 'text-amber-500', size: 16, extraClass: 'mr-1.5' }))
    // Phone / Mobile 📱
    .replace(/📱/g, getCustomIconHtml('smartphone', { colorClass: 'text-blue-500', size: 16, extraClass: 'mr-1' }))
    // Zap / Fast ⚡
    .replace(/⚡/g, getCustomIconHtml('zap', { colorClass: 'text-amber-500', size: 16, extraClass: 'mr-1' }))
    // Tools / Fixes 🛠️ or 🛠
    .replace(/🛠️|🛠/g, getCustomIconHtml('tools', { colorClass: 'text-indigo-500', size: 16, extraClass: 'mr-1' }))
    // Bell / Notifications 🔔
    .replace(/🔔/g, getCustomIconHtml('bell', { colorClass: 'text-emerald-500', size: 16, extraClass: 'mr-1' }))
    // Scale of Justice ⚖️
    .replace(/⚖️|⚖/g, getCustomIconHtml('scale', { colorClass: 'text-blue-600 dark:text-blue-400', size: 16, extraClass: 'mr-1.5' }))
    // Calendar 📅 or 📆
    .replace(/📅|📆/g, getCustomIconHtml('calendar', { colorClass: 'text-indigo-500', size: 16, extraClass: 'mr-1' }))
    // Video 📹 or 🎥
    .replace(/📹|🎥/g, getCustomIconHtml('video', { colorClass: 'text-sky-500', size: 16, extraClass: 'mr-1' }))
    // Message Square / Chat 💬
    .replace(/💬|🗨️|🗨/g, getCustomIconHtml('message-square', { colorClass: 'text-purple-500', size: 16, extraClass: 'mr-1' }))
    // Globe 🌐
    .replace(/🌐/g, getCustomIconHtml('globe', { colorClass: 'text-teal-500', size: 16, extraClass: 'mr-1' }))
    // Clock / Timer ⏰ or ⏱️ or ⏱ or ⌛
    .replace(/⏰|⏱️|⏱|⌛/g, getCustomIconHtml('clock', { colorClass: 'text-amber-500', size: 16, extraClass: 'mr-1' }))
    // Security Lock 🔒
    .replace(/🔒/g, getCustomIconHtml('lock', { colorClass: 'text-emerald-600', size: 16, extraClass: 'mr-1' }))
    // Link 🔗
    .replace(/🔗/g, getCustomIconHtml('external-link', { colorClass: 'text-blue-500', size: 16, extraClass: 'mr-1' }))
    // Phone Call 📞
    .replace(/📞/g, getCustomIconHtml('phone', { colorClass: 'text-emerald-500', size: 16, extraClass: 'mr-1' }))
    // Check ✅
    .replace(/✅/g, getCustomIconHtml('check-circle', { colorClass: 'text-emerald-500', size: 16, extraClass: 'mr-1' }))
    // Info ℹ️
    .replace(/ℹ️|ℹ/g, getCustomIconHtml('info', { colorClass: 'text-blue-500', size: 16, extraClass: 'mr-1' }))
    // Alert / Siren 🚨
    .replace(/🚨/g, getCustomIconHtml('alert-triangle', { colorClass: 'text-rose-500', size: 16, extraClass: 'mr-1' }))
    // Celebration / Confetti 🎉
    .replace(/🎉/g, getCustomIconHtml('award', { colorClass: 'text-amber-500', size: 16, extraClass: 'mr-1' }))
    // Book / Statute 📖
    .replace(/📖/g, getCustomIconHtml('book-open', { colorClass: 'text-indigo-500', size: 16, extraClass: 'mr-1' }))
    // Document / Scroll 📜
    .replace(/📜/g, getCustomIconHtml('file-text', { colorClass: 'text-amber-500', size: 16, extraClass: 'mr-1' }))
    // Note / Pen 📝
    .replace(/📝/g, getCustomIconHtml('edit', { colorClass: 'text-purple-500', size: 16, extraClass: 'mr-1' }))
    // Tip / Lightbulb 💡
    .replace(/💡/g, getCustomIconHtml('sparkles', { colorClass: 'text-amber-400', size: 16, extraClass: 'mr-1' }));
}
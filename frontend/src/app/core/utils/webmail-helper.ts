export interface WebmailProvider {
  provider: string;
  label: string;
  icon: string;
  url: string;
}

/**
 * Inspects an email address domain and provides a direct, 1-click webmail client launcher URL.
 */
export function getWebmailLauncher(email: string | null | undefined): WebmailProvider | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return null;

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return {
      provider: 'Gmail',
      label: 'Open Gmail',
      icon: 'mail',
      url: 'https://mail.google.com/mail/u/0/#search/from%3ALegalConnect'
    };
  }

  if (
    domain.includes('outlook') ||
    domain.includes('hotmail') ||
    domain.includes('live') ||
    domain.includes('msn')
  ) {
    return {
      provider: 'Outlook',
      label: 'Open Outlook',
      icon: 'mail',
      url: 'https://outlook.live.com/mail/0/inbox'
    };
  }

  if (domain.includes('yahoo') || domain === 'ymail.com') {
    return {
      provider: 'Yahoo Mail',
      label: 'Open Yahoo',
      icon: 'mail',
      url: 'https://mail.yahoo.com'
    };
  }

  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
    return {
      provider: 'iCloud',
      label: 'Open iCloud',
      icon: 'mail',
      url: 'https://www.icloud.com/mail'
    };
  }

  if (domain.includes('proton')) {
    return {
      provider: 'Proton',
      label: 'Open Proton',
      icon: 'mail',
      url: 'https://mail.proton.me'
    };
  }

  if (domain.includes('zoho')) {
    return {
      provider: 'Zoho Mail',
      label: 'Open Zoho',
      icon: 'mail',
      url: 'https://mail.zoho.com'
    };
  }

  return null;
}
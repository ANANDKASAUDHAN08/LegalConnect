export const environment = {
  production: false,
  demoMode: false, // Set to true if stakeholders want artificial delay for demo previewing
  smartLoadingThresholdMs: 150, // 150ms Stripe/Linear standard threshold to prevent loading flicker
  apiUrl: 'http://localhost:5001/api/admin',
  nodeUrl: 'http://localhost:5000/api/legal'
};
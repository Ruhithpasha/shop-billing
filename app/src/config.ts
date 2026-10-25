/**
 * The one place to point the app at the API.
 *
 * - Deployed API:      "https://shop-billing-api.<subdomain>.workers.dev"
 * - Local, on a phone: "http://<your-computer's-LAN-IP>:8787" and run `npm run dev:lan` in /api
 * - Local, in a browser or simulator on the same computer: "http://localhost:8787"
 */
export const API_BASE_URL = "http://localhost:8787";

/** Prices are stored in the smallest unit (pence/paise); this is only for display. */
export const CURRENCY_SYMBOL = "£";

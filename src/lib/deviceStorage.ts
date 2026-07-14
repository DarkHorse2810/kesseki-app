export const SELF_PLAYER_STORAGE_KEY = "kesseki-app:selectedPlayerId";
export const SELF_PLAYER_CACHE_KEY = "kesseki-app:selfPlayerCache";

export const SETTINGS_AUTH_STORAGE_KEY = "kesseki-app:settingsAuth";
export const SETTINGS_AUTH_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const LAST_PAGE_COOKIE_NAME = "kesseki-last-page";

export type LastPage = "absence" | "schedule" | "today";

export function rememberLastPage(page: LastPage) {
  document.cookie = `${LAST_PAGE_COOKIE_NAME}=${page}; path=/; max-age=31536000`;
}

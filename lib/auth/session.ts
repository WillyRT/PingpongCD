/**
 * Unified Session & HMAC Authentication Module
 * Provides robust fallback to guarantee that missing environment variables never trigger HTTP 500 errors.
 */

export {
  getSigningSecret,
  createPlayerSessionToken,
  verifyPlayerSessionToken,
  setPlayerSessionCookie,
  getPlayerSession,
  clearPlayerSessionCookie,
  PLAYER_SESSION_COOKIE,
  PLAYER_SESSION_COOKIE_OPTIONS,
  type PlayerSessionPayload,
} from './player-session';

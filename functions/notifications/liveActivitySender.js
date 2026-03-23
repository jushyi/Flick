const crypto = require('crypto');
const http2 = require('http2');
const logger = require('../logger');

// Derive iOS bundle ID from Firebase project.
const projectId =
  JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId || process.env.GCLOUD_PROJECT || '';
const IOS_BUNDLE_ID =
  projectId === 'flick-prod-49615' ? 'com.spoodsjs.flick' : 'com.spoodsjs.flick.dev';

// APNs endpoint — dev builds use sandbox, prod builds use production.
// Dev builds generate sandbox tokens regardless of aps-environment in app.json.
const APNS_HOST =
  projectId === 'flick-prod-49615' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';

// APNs auth key credentials (set via Firebase environment config or Secret Manager)
// Store these with: firebase functions:secrets:set APNS_KEY_ID, APNS_TEAM_ID, APNS_AUTH_KEY_P8
const APNS_KEY_ID = process.env.APNS_KEY_ID || '';
const APNS_TEAM_ID = process.env.APNS_TEAM_ID || '';
const APNS_AUTH_KEY_P8 = process.env.APNS_AUTH_KEY_P8 || '';

/**
 * Generate a JWT for APNS authentication.
 * Uses ES256 algorithm with the .p8 auth key.
 * Tokens are valid for up to 1 hour.
 */
let cachedJwt = null;
let cachedJwtExpiry = 0;

function getApnsJwt() {
  const now = Math.floor(Date.now() / 1000);

  // Reuse cached token if still valid (refresh 5 min before expiry)
  if (cachedJwt && now < cachedJwtExpiry - 300) {
    return cachedJwt;
  }

  const header = Buffer.from(
    JSON.stringify({
      alg: 'ES256',
      kid: APNS_KEY_ID,
    })
  ).toString('base64url');

  const claims = Buffer.from(
    JSON.stringify({
      iss: APNS_TEAM_ID,
      iat: now,
    })
  ).toString('base64url');

  const signingInput = `${header}.${claims}`;

  // Normalize the .p8 key — secrets may store it as one line with no newlines.
  // Node crypto requires proper PEM format with newlines after headers.
  let keyPem = APNS_AUTH_KEY_P8.replace(/\\n/g, '\n');

  // Extract just the base64 content, then re-wrap with proper PEM format
  const rawKey = keyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\s\n\r]/g, '');
  keyPem = `-----BEGIN PRIVATE KEY-----\n${rawKey}\n-----END PRIVATE KEY-----\n`;

  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  const signature = sign.sign(keyPem, 'base64url');

  cachedJwt = `${signingInput}.${signature}`;
  cachedJwtExpiry = now + 3600; // 1 hour

  return cachedJwt;
}

/**
 * Send a push-to-start Live Activity payload directly to APNS.
 * Bypasses FCM entirely — sends HTTP/2 POST to api.push.apple.com.
 *
 * @param {object} params
 * @param {string} params.pushToStartToken - Push-to-start token (hex string from ActivityKit)
 * @param {string} params.activityId - Unique ID for the pinned snap activity
 * @param {string} params.senderName - Sender's display name
 * @param {string} params.caption - Optional caption text
 * @param {string} params.conversationId - Conversation ID for deep link
 * @param {string} params.thumbnailUrl - Signed URL for thumbnail
 * @returns {Promise<{success: boolean, apnsId?: string, error?: string}>}
 */
async function sendPushToStartLiveActivity({
  pushToStartToken,
  activityId,
  senderName,
  caption,
  conversationId,
  thumbnailUrl,
}) {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_AUTH_KEY_P8) {
    logger.error('sendPushToStartLiveActivity: Missing APNS credentials', {
      hasKeyId: !!APNS_KEY_ID,
      hasTeamId: !!APNS_TEAM_ID,
      hasAuthKey: !!APNS_AUTH_KEY_P8,
    });
    return { success: false, error: 'APNS credentials not configured' };
  }

  // Debug: log key shape to diagnose PEM parsing issues
  logger.info('sendPushToStartLiveActivity: Key debug', {
    keyLength: APNS_AUTH_KEY_P8.length,
    startsWithDash: APNS_AUTH_KEY_P8.startsWith('-----'),
    hasBeginMarker: APNS_AUTH_KEY_P8.includes('BEGIN PRIVATE KEY'),
    first40: APNS_AUTH_KEY_P8.substring(0, 40),
    last20: APNS_AUTH_KEY_P8.substring(APNS_AUTH_KEY_P8.length - 20),
    newlineCount: (APNS_AUTH_KEY_P8.match(/\n/g) || []).length,
  });

  const payload = JSON.stringify({
    aps: {
      timestamp: Math.floor(Date.now() / 1000),
      event: 'start',
      'content-state': {
        stack: [
          {
            snapActivityId: activityId,
            senderName: senderName,
            caption: caption || null,
            conversationId: conversationId,
          },
        ],
      },
      'attributes-type': 'PinnedSnapAttributes',
      attributes: {
        activityId: activityId,
        senderName: senderName,
        caption: caption || '',
        deepLinkUrl: `lapse://messages/${conversationId}`,
      },
      alert: {
        title: `${senderName} pinned a snap`,
        body: caption || 'Tap to view',
      },
    },
  });

  const topic = `${IOS_BUNDLE_ID}.push-type.liveactivity`;

  try {
    const jwt = getApnsJwt();

    logger.info('sendPushToStartLiveActivity: Sending direct to APNS', {
      activityId,
      senderName,
      conversationId,
      host: APNS_HOST,
      topic,
      pushToStartTokenLength: pushToStartToken ? pushToStartToken.length : 0,
      pushToStartToken: pushToStartToken,
      devicePath: `/3/device/${pushToStartToken}`,
      bundleId: IOS_BUNDLE_ID,
    });

    const result = await new Promise((resolve, reject) => {
      const client = http2.connect(`https://${APNS_HOST}`);

      client.on('error', err => {
        client.close();
        reject(err);
      });

      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${pushToStartToken}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': topic,
        'apns-push-type': 'liveactivity',
        'apns-priority': '10',
        'content-type': 'application/json',
      });

      let body = '';
      let statusCode = 0;
      let responseHeaders = {};

      req.on('response', headers => {
        statusCode = headers[':status'];
        responseHeaders = headers;
      });

      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        client.close();
        resolve({
          statusCode,
          headers: responseHeaders,
          body: body || null,
        });
      });

      req.on('error', err => {
        client.close();
        reject(err);
      });

      req.write(payload);
      req.end();
    });

    if (result.statusCode === 200) {
      const apnsId = result.headers['apns-id'] || null;
      logger.info('sendPushToStartLiveActivity: Success', {
        activityId,
        apnsId,
        statusCode: result.statusCode,
      });
      return { success: true, apnsId };
    } else {
      const errorBody = result.body ? JSON.parse(result.body) : {};
      logger.error('sendPushToStartLiveActivity: APNS rejected', {
        activityId,
        statusCode: result.statusCode,
        reason: errorBody.reason || 'unknown',
        body: result.body,
      });
      return {
        success: false,
        error: `APNS ${result.statusCode}: ${errorBody.reason || result.body}`,
      };
    }
  } catch (error) {
    logger.error('sendPushToStartLiveActivity: Failed', {
      activityId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

module.exports = { sendPushToStartLiveActivity };

/**
 * Cloud Functions Validation Schemas
 *
 * Zod schemas for validating Firestore document shapes in Cloud Functions.
 * These provide defensive validation to catch malformed data early.
 *
 * Note: Uses z.any() for Firestore Timestamps since they don't serialize to JSON cleanly.
 * The goal is shape validation, not deep type enforcement on Firebase-specific types.
 */

const { z } = require('zod');
const logger = require('./logger');

// =============================================================================
// DOCUMENT SCHEMAS
// =============================================================================

/**
 * Darkroom document schema
 * Represents a user's darkroom state for photo reveals
 */
const DarkroomDocSchema = z.object({
  userId: z.string().min(1),
  nextRevealAt: z.any(), // Firestore Timestamp
  lastRevealedAt: z.any().nullable().optional(), // Firestore Timestamp, nullable
  lastNotifiedAt: z.any().optional(), // Firestore Timestamp, optional
});

/**
 * Photo document schema
 * Represents a photo in the system
 */
const PhotoDocSchema = z.object({
  userId: z.string().min(1),
  imageURL: z.string().url(),
  capturedAt: z.any(), // Firestore Timestamp
  revealedAt: z.any().nullable().optional(), // Firestore Timestamp, nullable
  status: z.enum(['developing', 'revealed', 'triaged']),
  photoState: z.enum(['journal', 'archive']).nullable().optional(),
  reactions: z.record(z.record(z.number())).optional(), // { [userId]: { [emoji]: count } }
  reactionCount: z.number().int().min(0).optional(),
});

/**
 * Friendship document schema
 * Represents a friendship or friend request between two users
 */
const FriendshipDocSchema = z.object({
  user1Id: z.string().min(1),
  user2Id: z.string().min(1),
  status: z.enum(['pending', 'accepted']),
  requestedBy: z.string().min(1),
  createdAt: z.any(), // Firestore Timestamp
  acceptedAt: z.any().optional(), // Firestore Timestamp, optional
});

/**
 * User document schema (partial - only fields used in Cloud Functions)
 * Used for validating user data when fetching for notifications
 */
const UserDocSchema = z.object({
  displayName: z.string().optional(),
  username: z.string().optional(),
  fcmToken: z.string().optional(),
  profilePhotoURL: z.string().url().optional(),
});

// =============================================================================
// VALIDATION HELPER
// =============================================================================

/**
 * Validate data against a schema, returning validated data or null
 * Logs a warning if validation fails
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @param {string} context - Context string for logging (e.g., "sendFriendRequestNotification")
 * @returns {object|null} Validated data or null if validation fails
 */
function validateOrNull(schema, data, context) {
  const result = schema.safeParse(data);

  if (!result.success) {
    logger.warn(`${context}: Validation failed`, {
      errors: result.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return null;
  }

  return result.data;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Schemas
  DarkroomDocSchema,
  PhotoDocSchema,
  FriendshipDocSchema,
  UserDocSchema,

  // Helper
  validateOrNull,
};

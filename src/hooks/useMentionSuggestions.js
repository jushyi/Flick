/**
 * useMentionSuggestions Hook
 *
 * Manages the @-mention autocomplete state for comments.
 * Loads mutual friends once on mount via Cloud Function,
 * then filters them locally as the user types after @.
 *
 * Features:
 * - Detects @ trigger near cursor position
 * - Filters suggestions by username/displayName (case-insensitive startsWith)
 * - Handles suggestion selection with text replacement
 * - Manages overlay visibility state
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getMutualFriendsForTagging } from '../services/firebase/mentionService';
import logger from '../utils/logger';

/**
 * useMentionSuggestions Hook
 *
 * @param {string} photoOwnerId - Photo owner's user ID
 * @param {string} currentUserId - Current user's ID
 * @returns {object} - Suggestion state and control functions
 */
const useMentionSuggestions = (photoOwnerId, currentUserId) => {
  const [allMutualFriends, setAllMutualFriends] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [queryText, setQueryText] = useState('');
  const loadedForOwnerRef = useRef(null);

  /**
   * Load mutual friends on mount (or when photoOwnerId changes).
   * Caches by photoOwnerId to avoid redundant fetches.
   */
  useEffect(() => {
    if (!photoOwnerId || !currentUserId) return;
    if (loadedForOwnerRef.current === photoOwnerId) return;

    const loadMutualFriends = async () => {
      logger.debug('useMentionSuggestions: Loading mutual friends', {
        photoOwnerId,
        currentUserId,
      });
      setLoading(true);

      const result = await getMutualFriendsForTagging(photoOwnerId);

      if (result.success) {
        logger.info('useMentionSuggestions: Loaded mutual friends', {
          count: result.data.length,
        });
        setAllMutualFriends(result.data);
        loadedForOwnerRef.current = photoOwnerId;
      } else {
        logger.warn('useMentionSuggestions: Failed to load mutual friends', {
          error: result.error,
        });
      }

      setLoading(false);
    };

    loadMutualFriends();
  }, [photoOwnerId, currentUserId]);

  /**
   * Find the active @-mention query near the cursor position.
   * Returns the query text (after @) or null if no active mention.
   *
   * @param {string} text - Full input text
   * @param {number} cursorPosition - Current cursor position
   * @returns {{ query: string, atIndex: number } | null}
   */
  const findActiveMention = useCallback((text, cursorPosition) => {
    if (!text || cursorPosition === undefined || cursorPosition === null) return null;

    // Look backward from cursor to find the nearest @
    const textBeforeCursor = text.slice(0, cursorPosition);

    // Find the last @ in text before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex === -1) return null;

    // The @ must be at start of text or preceded by a space/newline
    if (lastAtIndex > 0) {
      const charBefore = text[lastAtIndex - 1];
      if (charBefore !== ' ' && charBefore !== '\n') return null;
    }

    // Extract the query text between @ and cursor
    const query = text.slice(lastAtIndex + 1, cursorPosition);

    // Query must not contain spaces (no space means still typing username)
    if (query.includes(' ')) return null;

    return { query, atIndex: lastAtIndex };
  }, []);

  /**
   * Handle text changes from the input.
   * Detects if cursor is inside an @-mention being typed and filters suggestions.
   *
   * @param {string} fullText - Current full text
   * @param {number} cursorPosition - Current cursor position
   */
  const handleTextChange = useCallback(
    (fullText, cursorPosition) => {
      const activeMention = findActiveMention(fullText, cursorPosition);

      if (activeMention) {
        const { query } = activeMention;
        setQueryText(query);
        setShowSuggestions(true);

        // Filter mutual friends by username or displayName (case-insensitive startsWith)
        const lowerQuery = query.toLowerCase();
        const filtered = allMutualFriends.filter(friend => {
          const username = (friend.username || '').toLowerCase();
          const displayName = (friend.displayName || '').toLowerCase();
          return username.startsWith(lowerQuery) || displayName.startsWith(lowerQuery);
        });

        setFilteredSuggestions(filtered);
      } else {
        setShowSuggestions(false);
        setFilteredSuggestions([]);
        setQueryText('');
      }
    },
    [allMutualFriends, findActiveMention]
  );

  /**
   * Select a suggestion and replace the @query text with @username.
   *
   * @param {object} user - Selected user object { userId, username, displayName, profilePhotoURL }
   * @param {string} fullText - Current full text
   * @param {number} cursorPosition - Current cursor position
   * @returns {{ newText: string, newCursorPosition: number }}
   */
  const selectSuggestion = useCallback(
    (user, fullText, cursorPosition) => {
      const activeMention = findActiveMention(fullText, cursorPosition);

      if (!activeMention) {
        logger.warn('useMentionSuggestions.selectSuggestion: No active mention found');
        return { newText: fullText, newCursorPosition: cursorPosition };
      }

      const { atIndex } = activeMention;
      const username = user.username || user.displayName || 'user';
      const replacement = `@${username} `;

      // Build new text: text before @ + replacement + text after cursor
      const textBefore = fullText.slice(0, atIndex);
      const textAfter = fullText.slice(cursorPosition);
      const newText = textBefore + replacement + textAfter;
      const newCursorPosition = atIndex + replacement.length;

      logger.info('useMentionSuggestions.selectSuggestion: Inserted mention', {
        username,
        atIndex,
      });

      setShowSuggestions(false);
      setFilteredSuggestions([]);
      setQueryText('');

      return { newText, newCursorPosition };
    },
    [findActiveMention]
  );

  /**
   * Dismiss the suggestions overlay.
   */
  const dismissSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    setQueryText('');
  }, []);

  return {
    // State
    allMutualFriends,
    filteredSuggestions,
    loading,
    showSuggestions,
    queryText,
    // Actions
    handleTextChange,
    selectSuggestion,
    dismissSuggestions,
  };
};

export default useMentionSuggestions;

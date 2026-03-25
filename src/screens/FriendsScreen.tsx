import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  InteractionManager,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PixelSpinner from '../components/PixelSpinner';
import { supabase } from '../lib/supabase';
import PixelIcon from '../components/PixelIcon';
import { useAuth } from '../context/AuthContext';
import FriendCard from '../components/FriendCard';
import {
  getFriends,
  getPendingRequests,
  getSentRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  unfriend as removeFriend,
  getFriendshipStatus as checkFriendshipStatus,
} from '../services/supabase/friendshipService';
// TODO(20-01): getMutualFriendSuggestions, batchGetUsers - no supabase equivalent yet
const getMutualFriendSuggestions = async (_userId?: string): Promise<any> => ({ success: false, suggestions: [] });
const batchGetUsers = async (_userIds?: string[]): Promise<Map<string, any>> => new Map();
import {
  syncContacts as syncContactsAndFindSuggestions,
} from '../services/supabase/contactSyncService';
// TODO(20-01): hasUserSyncedContacts, checkContactsPermission, getDismissedSuggestionIds, etc. - need supabase equivalents
const hasUserSyncedContacts = async (_userId?: string): Promise<boolean> => false;
const checkContactsPermission = async (): Promise<string> => 'undetermined';
const getDismissedSuggestionIds = async (_userId?: string): Promise<string[]> => [];
const filterDismissedSuggestions = (suggestions: any[], _dismissedIds?: string[]): any[] => suggestions;
const dismissSuggestion = async (_userId?: string, _targetId?: string): Promise<void> => {};
const markContactsSyncCompleted = async (_userId?: string, _completed?: boolean): Promise<void> => {};
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
} from '../services/supabase/blockService';
// TODO(20-01): getBlockedByUserIds, getBlockedUserIds - map to supabase blockService
const getBlockedByUserIds = async (_userId?: string): Promise<any> => ({ success: false, blockedByUserIds: [] });
const getBlockedUserIds = async (_userId?: string): Promise<any> => ({ success: true, blockedUserIds: [] });
import { mediumImpact } from '../utils/haptics';
import { FriendsSkeleton } from '../components/skeletons/FriendsSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useScreenTrace } from '../hooks/useScreenTrace';
import { colors } from '../constants/colors';
import { styles } from '../styles/FriendsScreen.styles';
import logger from '../utils/logger';

/**
 * FriendsScreen - Unified friends management with tabbed interface
 *
 * Features:
 * - Requests | Friends tabs
 * - Requests tab: Incoming/Sent sections + user search to add friends
 * - Friends tab: Friend list with filter search + long press to remove
 * - Real-time updates via subscribeFriendships
 */
const FriendsScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // Screen load trace - measures time from mount to data-ready
  const { markLoaded } = useScreenTrace('FriendsScreen');
  const screenTraceMarkedRef = useRef(false);
  const initialLoadCompleteRef = useRef(false);

  const [activeTab, setActiveTab] = useState('requests');

  // Friends tab state
  const [friends, setFriends] = useState<any[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<any[]>([]);
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');

  // Requests tab state
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [requestsSearchQuery, setRequestsSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendshipStatuses, setFriendshipStatuses] = useState<Record<string, any>>({});

  // General state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [mutualSuggestions, setMutualSuggestions] = useState<any[]>([]);
  const [hasSyncedContacts, setHasSyncedContacts] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Block tracking state
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  const fetchFriends = async () => {
    try {
      const result = await getFriends(user!.id);

      // Collect all friend userIds for batch fetch
      const friendUserIds = result.map(friendship => friendship.friendUserId);

      // Batch fetch all user data at once (ceil(N/30) queries instead of N)
      const userMap = await batchGetUsers(friendUserIds);

      // Map friendship docs to friend objects using the batch-fetched Map
      const friendsWithUserData = result
        .map(friendship => {
          const otherUserId = friendship.friendUserId;
          const userData = userMap.get(otherUserId);
          if (userData) {
            return {
              friendshipId: friendship.id,
              userId: otherUserId,
              acceptedAt: friendship.createdAt,
              displayName: userData.displayName || userData.display_name,
              username: userData.username,
              profilePhotoURL: userData.profilePhotoURL || userData.photo_url,
              nameColor: userData.nameColor || userData.name_color,
            };
          }
          return null;
        })
        .filter(f => f !== null)
        .sort((a, b) => {
          const nameA = (a.displayName || a.username || '').toLowerCase();
          const nameB = (b.displayName || b.username || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

      setFriends(friendsWithUserData);
      setFilteredFriends(friendsWithUserData);
    } catch (err) {
      logger.error('Error in fetchFriends', err as Record<string, unknown>);
    }
  };

  const fetchRequests = async () => {
    try {
      const [incomingResult, sentResult] = await Promise.all([
        getPendingRequests(user!.id),
        getSentRequests(user!.id),
      ]);

      // Collect all userIds from both incoming and sent requests for a single batch fetch
      const allRequestUserIds: string[] = [];

      incomingResult.forEach(request => {
        const otherUserId = request.user1Id === user!.id ? request.user2Id : request.user1Id;
        allRequestUserIds.push(otherUserId);
      });

      sentResult.forEach(request => {
        const otherUserId = request.user1Id === user!.id ? request.user2Id : request.user1Id;
        allRequestUserIds.push(otherUserId);
      });

      // Batch fetch all user data at once
      const userMap = await batchGetUsers(allRequestUserIds);

      {
        const incomingWithUserData = incomingResult
          .map(request => {
            const otherUserId = request.user1Id === user!.id ? request.user2Id : request.user1Id;
            const userData = userMap.get(otherUserId);
            if (userData) {
              return {
                ...request,
                userId: otherUserId,
                displayName: userData.displayName || userData.display_name,
                username: userData.username,
                profilePhotoURL: userData.profilePhotoURL || userData.photo_url,
                nameColor: userData.nameColor || userData.name_color,
              };
            }
            return null;
          })
          .filter(r => r !== null);
        setIncomingRequests(incomingWithUserData);
      }

      {
        const sentWithUserData = sentResult
          .map(request => {
            const otherUserId = request.user1Id === user!.id ? request.user2Id : request.user1Id;
            const userData = userMap.get(otherUserId);
            if (userData) {
              return {
                ...request,
                userId: otherUserId,
                displayName: userData.displayName || userData.display_name,
                username: userData.username,
                profilePhotoURL: userData.profilePhotoURL || userData.photo_url,
                nameColor: userData.nameColor || userData.name_color,
              };
            }
            return null;
          })
          .filter(r => r !== null);
        setSentRequests(sentWithUserData);
      }
    } catch (err) {
      logger.error('Error in fetchRequests', err as Record<string, unknown>);
    }
  };

  const fetchSuggestions = async () => {
    try {
      // Check if user has synced contacts
      const synced = await hasUserSyncedContacts(user!.id);
      setHasSyncedContacts(synced);

      if (!synced) {
        setSuggestions([]);
        return;
      }

      // Check if permission is already granted before attempting sync
      // This prevents auto-firing the iOS permission dialog on screen load
      const hasPermission = await checkContactsPermission();
      if (!hasPermission) {
        setSuggestions([]);
        return;
      }

      // Get suggestions from contacts
      const contactSuggestions = await syncContactsAndFindSuggestions(user!.id);

      if (contactSuggestions && contactSuggestions.length > 0) {
        // Filter out dismissed suggestions
        const dismissedIds = await getDismissedSuggestionIds(user!.id);
        const filteredSuggestions = filterDismissedSuggestions(contactSuggestions, dismissedIds);
        setSuggestions(filteredSuggestions);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      logger.error('Error fetching suggestions', err as Record<string, unknown>);
      setSuggestions([]);
    }
  };

  const fetchMutualSuggestions = async () => {
    try {
      const result = await getMutualFriendSuggestions(user!.id);

      if (result.success && result.suggestions) {
        // Filter out dismissed suggestions
        const dismissedIds = await getDismissedSuggestionIds(user!.id);
        const dismissedSet = new Set(dismissedIds);
        // Note: mutual suggestions use userId (not id), so we filter manually
        // instead of using filterDismissedSuggestions which checks s.id
        const filtered = result.suggestions.filter(
          s => !dismissedSet.has(s.userId) && !blockedUserIds.includes(s.userId)
        );

        setMutualSuggestions(filtered);
      } else {
        setMutualSuggestions([]);
      }
    } catch (err) {
      logger.error('Error fetching mutual suggestions', err as Record<string, unknown>);
      setMutualSuggestions([]);
    }
  };

  const fetchBlockedUsers = async () => {
    try {
      const result = await getBlockedUserIds(user!.id);
      if (result.success) {
        setBlockedUserIds(result.blockedUserIds);
      }
    } catch (err) {
      logger.error('Error fetching blocked users', err as Record<string, unknown>);
    }
  };

  // Load critical data first (friends + requests), then defer non-critical data
  const loadCriticalData = async () => {
    setError(null);
    try {
      await Promise.all([fetchFriends(), fetchRequests()]);
    } catch (err) {
      logger.error('Error loading critical data', err as Record<string, unknown>);
      setError('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Lazy-load non-critical sections after critical path renders
  const loadDeferredData = useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      Promise.all([fetchSuggestions(), fetchBlockedUsers(), fetchMutualSuggestions()]).catch(err =>
        logger.error('Error loading deferred data', err as Record<string, unknown>)
      );
    });
    return task;
  }, [user!.id]);

  // Full reload for pull-to-refresh
  const loadAllData = async () => {
    setError(null);
    try {
      await Promise.all([
        fetchFriends(),
        fetchRequests(),
        fetchSuggestions(),
        fetchBlockedUsers(),
        fetchMutualSuggestions(),
      ]);
    } catch (err) {
      logger.error('Error loading data', err as Record<string, unknown>);
      setError('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Process incremental subscription changes instead of full reload
  const handleSubscriptionChanges = useCallback(
    async (allFriendships, changes) => {
      // Skip if no changes (initial snapshot is handled by loadCriticalData)
      if (!initialLoadCompleteRef.current) return;

      // If changes array is empty or too large, fall back to full reload
      if (!changes || changes.length === 0) return;
      if (changes.length > 10) {
        // Too many changes at once — full reload is simpler
        await Promise.all([fetchFriends(), fetchRequests()]);
        return;
      }

      // Collect userIds that need user data for added/modified docs
      const userIdsToFetch: string[] = [];
      changes.forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const otherUserId =
            change.data.user1Id === user!.id ? change.data.user2Id : change.data.user1Id;
          userIdsToFetch.push(otherUserId);
        }
      });

      // Batch fetch user data for new/modified items
      const userMap = userIdsToFetch.length > 0 ? await batchGetUsers(userIdsToFetch) : new Map();

      // Apply incremental updates to friends state
      setFriends(prevFriends => {
        let updated = [...prevFriends];

        changes.forEach(change => {
          const friendshipId = change.id;
          const otherUserId =
            change.data.user1Id === user!.id ? change.data.user2Id : change.data.user1Id;

          if (change.type === 'removed') {
            updated = updated.filter(f => f.friendshipId !== friendshipId);
          } else if (change.data.status === 'accepted') {
            const userData = userMap.get(otherUserId);
            if (!userData) return;

            const friendObj = {
              friendshipId,
              userId: otherUserId,
              acceptedAt: change.data.acceptedAt,
              displayName: userData.displayName,
              username: userData.username,
              profilePhotoURL: userData.profilePhotoURL || userData.photoURL,
              nameColor: userData.nameColor,
            };

            const existingIdx = updated.findIndex(f => f.friendshipId === friendshipId);
            if (existingIdx >= 0) {
              updated[existingIdx] = friendObj;
            } else if (change.type === 'added' || change.type === 'modified') {
              updated.push(friendObj);
            }
          } else if (change.data.status === 'pending') {
            // If a friendship changed from accepted to pending (unlikely) or was never accepted,
            // remove it from friends list
            updated = updated.filter(f => f.friendshipId !== friendshipId);
          }
        });

        // Re-sort alphabetically
        updated.sort((a, b) => {
          const nameA = (a.displayName || a.username || '').toLowerCase();
          const nameB = (b.displayName || b.username || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        return updated;
      });

      // Apply incremental updates to requests state
      changes.forEach(change => {
        const friendshipId = change.id;
        const otherUserId =
          change.data.user1Id === user!.id ? change.data.user2Id : change.data.user1Id;

        if (change.type === 'removed') {
          setIncomingRequests(prev => prev.filter(r => r.id !== friendshipId));
          setSentRequests(prev => prev.filter(r => r.id !== friendshipId));
        } else if (change.data.status === 'pending') {
          const userData = userMap.get(otherUserId);
          if (!userData) return;

          const requestObj = {
            id: friendshipId,
            ...change.data,
            userId: otherUserId,
            displayName: userData.displayName,
            username: userData.username,
            profilePhotoURL: userData.profilePhotoURL || userData.photoURL,
          };

          if (change.data.requestedBy === user!.id) {
            // Sent request
            setSentRequests(prev => {
              const exists = prev.some(r => r.id === friendshipId);
              if (exists) {
                return prev.map(r => (r.id === friendshipId ? requestObj : r));
              }
              return [...prev, requestObj];
            });
            // Ensure not in incoming
            setIncomingRequests(prev => prev.filter(r => r.id !== friendshipId));
            // Remove from suggestions (safety net for race condition with optimistic update)
            setSuggestions(prev => prev.filter(s => s.id !== otherUserId));
            setMutualSuggestions(prev => prev.filter(s => s.userId !== otherUserId));
          } else {
            // Incoming request
            setIncomingRequests(prev => {
              const exists = prev.some(r => r.id === friendshipId);
              if (exists) {
                return prev.map(r => (r.id === friendshipId ? requestObj : r));
              }
              return [...prev, requestObj];
            });
            // Ensure not in sent
            setSentRequests(prev => prev.filter(r => r.id !== friendshipId));
          }
        } else if (change.data.status === 'accepted') {
          // Accepted — remove from both request lists (already added to friends above)
          setIncomingRequests(prev => prev.filter(r => r.id !== friendshipId));
          setSentRequests(prev => prev.filter(r => r.id !== friendshipId));
        }
      });
    },
    [user!.id]
  );

  useEffect(() => {
    // Load critical data (friends + requests) first
    loadCriticalData().then(() => {
      initialLoadCompleteRef.current = true;
    });

    // Lazy-load non-critical data after interactions settle
    const deferredTask = loadDeferredData();

    // TODO(20-01): subscribeFriendships - no supabase equivalent yet, using polling via refresh
    const unsubscribe = () => {};

    return () => {
      unsubscribe();
      deferredTask.cancel();
    };
  }, [user?.id]);

  // Mark screen trace as loaded after initial data load (once only)
  useEffect(() => {
    if (!loading && !screenTraceMarkedRef.current) {
      screenTraceMarkedRef.current = true;
      markLoaded({ friend_count: friends.length });
    }
  }, [loading, friends.length]);

  useEffect(() => {
    if (!friendsSearchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const query = friendsSearchQuery.toLowerCase();
    const filtered = friends.filter(friend => {
      const displayName = (friend.displayName || '').toLowerCase();
      const username = (friend.username || '').toLowerCase();
      return displayName.includes(query) || username.includes(query);
    });

    setFilteredFriends(filtered);
  }, [friendsSearchQuery, friends]);

  // Debounced user search by username
  useEffect(() => {
    if (!requestsSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(requestsSearchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [requestsSearchQuery]);

  const searchUsers = async term => {
    try {
      setSearchLoading(true);
      const normalizedTerm = term.toLowerCase().trim();

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .ilike('username', `${normalizedTerm}%`)
        .limit(20);

      if (usersError) throw usersError;

      // Get users who have blocked the current user
      const blockedByResult = await getBlockedByUserIds(user!.id);
      const blockedByUserIds = blockedByResult.success ? blockedByResult.blockedByUserIds : [];

      const results: any[] = [];
      for (const userData of ((usersData || []) as any[])) {
        // Exclude self and users who have blocked current user
        if (userData.id !== user!.id && !blockedByUserIds.includes(userData.id)) {
          results.push({
            userId: userData.id,
            ...userData,
            profilePhotoURL: userData.profile_photo_url || userData.photo_url,
          });
        }
      }

      setSearchResults(results);

      // Fetch friendship status for each result
      if (results.length > 0) {
        const statuses: Record<string, any> = {};
        await Promise.all(
          results.map(async searchUser => {
            const status = await checkFriendshipStatus(user!.id, searchUser.userId);
            if (status) {
              statuses[searchUser.userId] = {
                status,
                friendshipId: null, // getFriendshipStatus returns status string only
              };
            }
          })
        );
        setFriendshipStatuses(statuses);
      }
    } catch (err) {
      logger.error('Error searching users', err as Record<string, unknown>);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const handleAddFriend = async userId => {
    try {
      setActionLoading(prev => ({ ...prev, [userId]: true }));
      mediumImpact();

      // Find suggestion data before removing (for adding to sent requests)
      const suggestion = suggestions.find(s => s.id === userId);
      const mutualSuggestion = mutualSuggestions.find(s => s.userId === userId);

      const result = await sendFriendRequest(user!.id, userId);
      // Remove from suggestions if present
      setSuggestions(prev => prev.filter(s => s.id !== userId));
      setMutualSuggestions(prev => prev.filter(s => s.userId !== userId));

      // Add to sent requests if we had the user data from suggestions
      if (suggestion) {
        setSentRequests(prev => {
          if (prev.some(r => r.id === result.id || r.userId === suggestion.id))
            return prev;
          return [
            ...prev,
            {
              id: result.id, // Use 'id' to match server data shape
              userId: suggestion.id,
              displayName: suggestion.displayName,
              username: suggestion.username,
              profilePhotoURL: suggestion.profilePhotoURL || suggestion.photoURL,
            },
          ];
        });
      } else if (mutualSuggestion) {
        setSentRequests(prev => {
          if (
            prev.some(r => r.id === result.id || r.userId === mutualSuggestion.userId)
          )
            return prev;
          return [
            ...prev,
            {
              id: result.id,
              userId: mutualSuggestion.userId,
              displayName: mutualSuggestion.displayName,
              username: mutualSuggestion.username,
              profilePhotoURL: mutualSuggestion.profilePhotoURL,
            },
          ];
        });
      }

      // Update local state for search results
      setFriendshipStatuses(prev => ({
        ...prev,
        [userId]: { status: 'pending_sent', friendshipId: result.id },
      }));
    } catch (err) {
      logger.error('Error sending friend request', err as Record<string, unknown>);
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDismissSuggestion = async userId => {
    try {
      mediumImpact();

      // Optimistic update
      setSuggestions(prev => prev.filter(s => s.id !== userId));

      // Persist dismissal
      await dismissSuggestion(user!.id, userId);
    } catch (err) {
      logger.error('Error dismissing suggestion', err as Record<string, unknown>);
      // Refresh suggestions on error
      fetchSuggestions();
    }
  };

  const handleDismissMutualSuggestion = async userId => {
    try {
      mediumImpact();
      // Optimistic update
      setMutualSuggestions(prev => prev.filter(s => s.userId !== userId));
      // Persist dismissal (reuses same dismissedSuggestions array)
      await dismissSuggestion(user!.id, userId);
    } catch (err) {
      logger.error('Error dismissing mutual suggestion', err as Record<string, unknown>);
      fetchMutualSuggestions();
    }
  };

  const handleSyncContacts = async () => {
    try {
      setSuggestionsLoading(true);
      mediumImpact();

      const contactSuggestions = await syncContactsAndFindSuggestions(user!.id);

      // Mark sync as completed
      await markContactsSyncCompleted(user!.id, true);
      setHasSyncedContacts(true);

      // Update suggestions
      const dismissedIds = await getDismissedSuggestionIds(user!.id);
      const filteredSuggestions = filterDismissedSuggestions(
        contactSuggestions || [],
        dismissedIds
      );
      setSuggestions(filteredSuggestions);

      if (filteredSuggestions.length === 0) {
        Alert.alert(
          'No Friends Found',
          'None of your contacts are on FLICK yet. Invite them to join!'
        );
      }
    } catch (err) {
      logger.error('Error syncing contacts', err as Record<string, unknown>);
      Alert.alert('Error', 'Failed to sync contacts');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleAcceptRequest = async friendshipId => {
    try {
      setActionLoading(prev => ({ ...prev, [friendshipId]: true }));
      mediumImpact();

      await acceptFriendRequest(friendshipId);
      // Real-time listener will update the UI
    } catch (err) {
      logger.error('Error accepting friend request', err as Record<string, unknown>);
      Alert.alert('Error', 'Failed to accept friend request');
    } finally {
      setActionLoading(prev => ({ ...prev, [friendshipId]: false }));
    }
  };

  const handleDenyRequest = async friendshipId => {
    try {
      setActionLoading(prev => ({ ...prev, [friendshipId]: true }));
      mediumImpact();

      await declineFriendRequest(friendshipId);
      // Real-time listener will update the UI
    } catch (err) {
      logger.error('Error declining friend request', err as Record<string, unknown>);
      Alert.alert('Error', 'Failed to decline friend request');
    } finally {
      setActionLoading(prev => ({ ...prev, [friendshipId]: false }));
    }
  };

  const handleCancelRequest = async (friendshipId, actionType) => {
    if (actionType === 'cancel') {
      try {
        mediumImpact();

        // Find the sent request data before removing (to add back to suggestions if applicable)
        const sentRequest = sentRequests.find(r => r.id === friendshipId);

        await declineFriendRequest(friendshipId);
        // Remove from sent requests state
        setSentRequests(prev => prev.filter(r => r.id !== friendshipId));

        // If this was someone from contacts sync, add back to suggestions
        // (The subscription will also refresh, but this gives immediate feedback)
        if (sentRequest && hasSyncedContacts) {
          setSuggestions(prev => [
            ...prev,
            {
              id: sentRequest.userId,
              displayName: sentRequest.displayName,
              username: sentRequest.username,
              profilePhotoURL: sentRequest.profilePhotoURL,
            },
          ]);
        }
      } catch (err) {
        logger.error('Error canceling friend request', err as Record<string, unknown>);
        Alert.alert('Error', 'Failed to cancel friend request');
      }
    }
  };

  const handleRemoveFriend = friend => {
    const buttons: import('react-native').AlertButton[] = [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            mediumImpact();
            await removeFriend(friend.friendshipId);
            // Real-time listener will update the UI
          } catch (err) {
            logger.error('Error removing friend', err as Record<string, unknown>);
            Alert.alert('Error', 'Failed to remove friend');
          }
        },
      },
    ];
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.displayName || friend.username} as a friend?`,
      Platform.OS === 'android' ? [...buttons].reverse() : buttons
    );
  };

  const handleRemoveFriendFromMenu = async userId => {
    try {
      mediumImpact();
      const friend = friends.find(f => f.userId === userId);
      if (!friend) return;
      await removeFriend(friend.friendshipId);
      // Optimistic update - remove from list
      setFriends(prev => prev.filter(f => f.userId !== userId));
      setFilteredFriends(prev => prev.filter(f => f.userId !== userId));
      logger.info('FriendsScreen: Friend removed via menu', { userId });
    } catch (err) {
      logger.error('FriendsScreen: Error removing friend via menu', { error: (err as Error).message });
      Alert.alert('Error', 'Could not remove friend');
    }
  };

  const handleBlockUser = async userId => {
    try {
      mediumImpact();
      await blockUser(user!.id, userId);
      // Remove from all lists and track as blocked
      setFriends(prev => prev.filter(f => f.userId !== userId));
      setFilteredFriends(prev => prev.filter(f => f.userId !== userId));
      setSuggestions(prev => prev.filter(s => s.id !== userId));
      setMutualSuggestions(prev => prev.filter(s => s.userId !== userId));
      setBlockedUserIds(prev => [...prev, userId]);
      logger.info('FriendsScreen: User blocked via menu', { userId });
    } catch (err) {
      logger.error('FriendsScreen: Error blocking user via menu', { error: (err as Error).message });
      Alert.alert('Error', 'Could not block user');
    }
  };

  const handleUnblockUser = async userId => {
    try {
      mediumImpact();
      await unblockUser(user!.id, userId);
      // Remove from blocked list
      setBlockedUserIds(prev => prev.filter(id => id !== userId));
      logger.info('FriendsScreen: User unblocked via menu', { userId });
    } catch (err) {
      logger.error('FriendsScreen: Error unblocking user via menu', { error: (err as Error).message });
      Alert.alert('Error', 'Could not unblock user');
    }
  };

  const handleReportUser = userId => {
    // Find the friend data to pass to report screen
    const friend = friends.find(f => f.userId === userId);
    navigation.navigate('ReportUser', {
      userId,
      username: friend?.username,
      displayName: friend?.displayName,
      profilePhotoURL: friend?.profilePhotoURL,
    });
  };

  const handleSearchAction = async (userId, actionType) => {
    if (actionType === 'add') {
      await handleAddFriend(userId);
    } else if (actionType === 'cancel') {
      const statusInfo = friendshipStatuses[userId];
      if (statusInfo?.friendshipId) {
        await handleCancelRequest(statusInfo.friendshipId, 'cancel');
        // Update local state
        setFriendshipStatuses(prev => ({
          ...prev,
          [userId]: { status: 'none', friendshipId: statusInfo.friendshipId },
        }));
      }
    }
  };

  const renderSearchBar = (value: string, setValue: (v: string) => void, placeholder: string, testID?: string) => (
    <View style={styles.searchContainer}>
      <TextInput
        testID={testID}
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => setValue('')} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSectionHeader = title => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderEmptyState = (icon, title, text) => (
    <View style={styles.emptyContainer}>
      <PixelIcon name={icon} size={48} color={colors.text.tertiary} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

  const renderSyncPrompt = () => (
    <View style={styles.syncPromptContainer}>
      <PixelIcon
        name="people-outline"
        size={40}
        color={colors.interactive.primary}
        style={styles.syncPromptIcon}
      />
      <Text style={styles.syncPromptTitle}>Find Friends from Contacts</Text>
      <Text style={styles.syncPromptText}>See which of your contacts are on FLICK</Text>
      <TouchableOpacity
        style={styles.syncPromptButton}
        onPress={handleSyncContacts}
        activeOpacity={0.7}
        disabled={suggestionsLoading}
      >
        {suggestionsLoading ? (
          <PixelSpinner size="small" color={colors.text.primary} />
        ) : (
          <Text style={styles.syncPromptButtonText}>Sync Contacts</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSuggestionCard = suggestion => (
    <FriendCard
      user={{
        userId: suggestion.id,
        displayName: suggestion.displayName,
        username: suggestion.username,
        profilePhotoURL: suggestion.profilePhotoURL || suggestion.photoURL,
      }}
      relationshipStatus="none"
      onAction={userId => handleAddFriend(userId)}
      onDismiss={userId => handleDismissSuggestion(userId)}
      loading={actionLoading[suggestion.id]}
      onPress={() => {
        navigation.navigate('OtherUserProfile', {
          userId: suggestion.id,
          username: suggestion.username,
        });
      }}
      onBlock={handleBlockUser}
      onUnblock={handleUnblockUser}
      onReport={handleReportUser}
      isBlocked={blockedUserIds.includes(suggestion.id)}
    />
  );

  const renderFriendsTab = () => {
    if (loading && friends.length === 0) {
      return <FriendsSkeleton />;
    }

    return (
      <>
        {renderSearchBar(
          friendsSearchQuery,
          setFriendsSearchQuery,
          'Search friends...',
          'friends-search-input'
        )}
        <FlatList
          testID="friends-list"
          data={filteredFriends}
          renderItem={({ item }) => (
            <TouchableOpacity onLongPress={() => handleRemoveFriend(item)}>
              <FriendCard
                user={item}
                relationshipStatus="friends"
                showFriendsSince={true}
                friendsSince={item.acceptedAt}
                onPress={() => {
                  navigation.navigate('OtherUserProfile', {
                    userId: item.userId,
                    username: item.username,
                  });
                }}
                onRemove={handleRemoveFriendFromMenu}
                onBlock={handleBlockUser}
                onUnblock={handleUnblockUser}
                onReport={handleReportUser}
                isBlocked={blockedUserIds.includes(item.userId)}
              />
            </TouchableOpacity>
          )}
          keyExtractor={item => item.friendshipId}
          contentContainerStyle={[
            styles.listContent,
            Platform.OS === 'android' && { paddingBottom: insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.interactive.primary}
              colors={[colors.interactive.primary]}
              progressBackgroundColor={colors.background.secondary}
            />
          }
          ListEmptyComponent={
            friendsSearchQuery.trim()
              ? renderEmptyState(
                  'search-outline',
                  'No friends found',
                  'Try a different search term'
                )
              : <EmptyState
                  icon="people-outline"
                  message="No friends yet"
                  ctaLabel="Find friends"
                  onCtaPress={() => navigation.navigate('ContactsSync')}
                />
          }
        />
      </>
    );
  };

  const renderRequestsTab = () => {
    if (loading && incomingRequests.length === 0 && sentRequests.length === 0) {
      return <FriendsSkeleton />;
    }

    // If searching, show search results
    if (requestsSearchQuery.trim()) {
      return (
        <>
          {renderSearchBar(requestsSearchQuery, setRequestsSearchQuery, 'Search users to add...')}
          {searchLoading ? (
            <View style={styles.loadingContainer}>
              <PixelSpinner size="large" color={colors.text.primary} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={({ item }) => {
                const statusInfo = friendshipStatuses[item.userId] || { status: 'none' };
                return (
                  <FriendCard
                    user={item}
                    relationshipStatus={statusInfo.status}
                    friendshipId={statusInfo.friendshipId}
                    onAction={handleSearchAction}
                    onAccept={() => handleAcceptRequest(statusInfo.friendshipId)}
                    onDeny={() => handleDenyRequest(statusInfo.friendshipId)}
                    loading={actionLoading[item.userId]}
                    onPress={() => {
                      navigation.navigate('OtherUserProfile', {
                        userId: item.userId,
                        username: item.username,
                      });
                    }}
                    onRemove={handleRemoveFriendFromMenu}
                    onBlock={handleBlockUser}
                    onUnblock={handleUnblockUser}
                    onReport={handleReportUser}
                    isBlocked={blockedUserIds.includes(item.userId)}
                  />
                );
              }}
              keyExtractor={item => item.userId}
              contentContainerStyle={[
                styles.listContent,
                Platform.OS === 'android' && { paddingBottom: insets.bottom },
              ]}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={true}
              ListEmptyComponent={renderEmptyState(
                'search-outline',
                'No users found',
                'Try a different username'
              )}
            />
          )}
        </>
      );
    }

    // Show incoming and sent request sections
    const hasIncoming = incomingRequests.length > 0;
    const hasSent = sentRequests.length > 0;
    const hasSuggestions = suggestions.length > 0;

    // Build sections data
    const sections: any[] = [];

    // Add incoming requests section
    if (hasIncoming) {
      sections.push({ type: 'header', title: 'Incoming' });
      incomingRequests.forEach(request => {
        sections.push({ type: 'incoming', data: request });
      });
    }

    // Add sent requests section
    if (hasSent) {
      sections.push({ type: 'header', title: 'Sent' });
      sentRequests.forEach(request => {
        sections.push({ type: 'sent', data: request });
      });
    }

    // Add suggestions section (or sync prompt)
    if (hasSyncedContacts) {
      if (hasSuggestions) {
        sections.push({ type: 'header', title: 'Suggestions' });
        suggestions.forEach(suggestion => {
          sections.push({ type: 'suggestion', data: suggestion });
        });
      }
    } else {
      // User hasn't synced contacts - show prompt
      sections.push({ type: 'sync_prompt' });
    }

    // Add mutual friend suggestions section
    const hasMutualSuggestions = mutualSuggestions.length > 0;
    if (hasMutualSuggestions) {
      sections.push({ type: 'header', title: 'People You May Know' });
      mutualSuggestions.forEach(suggestion => {
        sections.push({ type: 'mutual_suggestion', data: suggestion });
      });
    }

    // Render function for items
    const renderItem = ({ item }) => {
      if (item.type === 'header') {
        return renderSectionHeader(item.title);
      }

      if (item.type === 'sync_prompt') {
        return renderSyncPrompt();
      }

      if (item.type === 'incoming') {
        return (
          <FriendCard
            user={item.data}
            relationshipStatus="pending_received"
            friendshipId={item.data.id}
            onAccept={handleAcceptRequest}
            onDeny={handleDenyRequest}
            loading={actionLoading[item.data.id]}
            onPress={() => {
              navigation.navigate('OtherUserProfile', {
                userId: item.data.userId,
                username: item.data.username,
              });
            }}
            onBlock={handleBlockUser}
            onUnblock={handleUnblockUser}
            onReport={handleReportUser}
            isBlocked={blockedUserIds.includes(item.data.userId)}
          />
        );
      }

      if (item.type === 'sent') {
        return (
          <FriendCard
            user={item.data}
            relationshipStatus="pending_sent"
            friendshipId={item.data.id}
            onAction={handleCancelRequest}
            loading={actionLoading[item.data.id]}
            onPress={() => {
              navigation.navigate('OtherUserProfile', {
                userId: item.data.userId,
                username: item.data.username,
              });
            }}
            onBlock={handleBlockUser}
            onUnblock={handleUnblockUser}
            onReport={handleReportUser}
            isBlocked={blockedUserIds.includes(item.data.userId)}
          />
        );
      }

      if (item.type === 'suggestion') {
        return renderSuggestionCard(item.data);
      }

      if (item.type === 'mutual_suggestion') {
        return (
          <FriendCard
            user={{
              userId: item.data.userId,
              displayName: item.data.displayName,
              username: item.data.username,
              profilePhotoURL: item.data.profilePhotoURL,
            }}
            relationshipStatus="none"
            subtitle={`${item.data.mutualCount} mutual friend${item.data.mutualCount !== 1 ? 's' : ''}`}
            onAction={userId => handleAddFriend(userId)}
            onDismiss={userId => handleDismissMutualSuggestion(userId)}
            loading={actionLoading[item.data.userId]}
            onPress={() => {
              navigation.navigate('OtherUserProfile', {
                userId: item.data.userId,
                username: item.data.username,
              });
            }}
            onBlock={handleBlockUser}
            onUnblock={handleUnblockUser}
            onReport={handleReportUser}
            isBlocked={blockedUserIds.includes(item.data.userId)}
          />
        );
      }

      return null;
    };

    // Key extractor
    const keyExtractor = (item, index) => {
      if (item.type === 'header') return `header-${item.title}`;
      if (item.type === 'sync_prompt') return 'sync-prompt';
      // Include item type in key to prevent duplicates when same user appears in multiple sections
      return `${item.type}-${item.data?.id || item.data?.userId || index}`;
    };

    return (
      <>
        {renderSearchBar(requestsSearchQuery, setRequestsSearchQuery, 'Search users to add...')}
        {sections.length > 0 ? (
          <FlatList
            data={sections}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              styles.listContent,
              Platform.OS === 'android' && { paddingBottom: insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.interactive.primary}
                colors={[colors.interactive.primary]}
                progressBackgroundColor={colors.background.secondary}
              />
            }
          />
        ) : (
          <View style={{ flex: 1 }}>
            {renderEmptyState(
              'mail-outline',
              'No friend requests',
              'Search for users by username to add friends'
            )}
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends</Text>
      </View>

      {/* Tab navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
          activeOpacity={0.7}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              Requests
            </Text>
            {incomingRequests.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{incomingRequests.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Tab content */}
      {activeTab === 'friends' ? renderFriendsTab() : renderRequestsTab()}
    </SafeAreaView>
  );
};

export default FriendsScreen;

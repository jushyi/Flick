/**
 * useOptimisticMutation - Reusable optimistic mutation wrapper
 *
 * Standardizes the onMutate/onError/onSettled pattern with:
 * - Automatic cache snapshot and rollback on error
 * - Toast notification on failure
 * - Single-key and multi-key support (e.g., reactions update photo detail + feed)
 * - Callback passthrough for consumer extensions (e.g., haptic feedback)
 *
 * @see D-05, D-06, D-07, PERF-04
 */

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type MutationFunction,
  type UseMutationResult,
} from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

// =============================================================================
// Types
// =============================================================================

/** Single cache key updater (simple case) */
interface SingleKeyOptions<TData, TVariables, TQueryData = unknown> {
  mutationFn: MutationFunction<TData, TVariables>;
  queryKey: QueryKey | ((variables: TVariables) => QueryKey);
  updater: (old: TQueryData | undefined, variables: TVariables) => TQueryData;
  errorMessage: string;
  invalidateKeys?: QueryKey[];
  onSuccess?: (data: TData, variables: TVariables) => void;
  onMutate?: (variables: TVariables) => void;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
  ) => void;
}

/** Individual entry in the multi-key updaters array */
interface MultiKeyUpdater<TVariables> {
  queryKey: QueryKey | ((variables: TVariables) => QueryKey);
  updater: (old: unknown, variables: TVariables) => unknown;
}

/** Multi-key updater (for operations like reactions that update multiple caches) */
interface MultiKeyOptions<TData, TVariables> {
  mutationFn: MutationFunction<TData, TVariables>;
  updaters: MultiKeyUpdater<TVariables>[];
  errorMessage: string;
  invalidateKeys?: QueryKey[];
  onSuccess?: (data: TData, variables: TVariables) => void;
  onMutate?: (variables: TVariables) => void;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
  ) => void;
}

type OptimisticMutationOptions<TData, TVariables, TQueryData = unknown> =
  | SingleKeyOptions<TData, TVariables, TQueryData>
  | MultiKeyOptions<TData, TVariables>;

/** Rollback context stored by onMutate */
interface MutationContext {
  previous: Map<string, unknown>;
  resolvedKeys: QueryKey[];
}

// =============================================================================
// Helpers
// =============================================================================

function isMultiKey<TData, TVariables>(
  opts: OptimisticMutationOptions<TData, TVariables>,
): opts is MultiKeyOptions<TData, TVariables> {
  return 'updaters' in opts && Array.isArray(opts.updaters);
}

function resolveKey<TVariables>(
  key: QueryKey | ((variables: TVariables) => QueryKey),
  variables: TVariables,
): QueryKey {
  return typeof key === 'function' ? key(variables) : key;
}

/** Stable serialization of a QueryKey for Map storage */
function serializeKey(key: QueryKey): string {
  return JSON.stringify(key);
}

// =============================================================================
// Hook
// =============================================================================

export function useOptimisticMutation<
  TData = unknown,
  TVariables = unknown,
  TQueryData = unknown,
>(
  options: OptimisticMutationOptions<TData, TVariables, TQueryData>,
): UseMutationResult<TData, Error, TVariables, MutationContext> {
  const queryClient = useQueryClient();

  // Build the list of { queryKey resolver, updater } pairs
  const entries: MultiKeyUpdater<TVariables>[] = isMultiKey(options as OptimisticMutationOptions<TData, TVariables>)
    ? (options as MultiKeyOptions<TData, TVariables>).updaters
    : [
        {
          queryKey: (options as SingleKeyOptions<TData, TVariables, TQueryData>)
            .queryKey,
          updater: (options as SingleKeyOptions<TData, TVariables, TQueryData>)
            .updater as (old: unknown, variables: TVariables) => unknown,
        },
      ];

  return useMutation<TData, Error, TVariables, MutationContext>({
    mutationFn: options.mutationFn,

    onMutate: async (variables: TVariables): Promise<MutationContext> => {
      const previous = new Map<string, unknown>();
      const resolvedKeys: QueryKey[] = [];

      for (const entry of entries) {
        const key = resolveKey(entry.queryKey, variables);
        resolvedKeys.push(key);

        await queryClient.cancelQueries({ queryKey: key });
        const snapshot = queryClient.getQueryData(key);
        previous.set(serializeKey(key), snapshot);
        queryClient.setQueryData(key, (old: unknown) =>
          entry.updater(old, variables),
        );
      }

      // Consumer callback passthrough
      options.onMutate?.(variables);

      return { previous, resolvedKeys };
    },

    onError: (
      _error: Error,
      _variables: TVariables,
      context: MutationContext | undefined,
    ) => {
      // Rollback all snapshots
      if (context?.previous) {
        for (const [serialized, snapshot] of context.previous) {
          const key = JSON.parse(serialized) as QueryKey;
          queryClient.setQueryData(key, snapshot);
        }
      }

      Toast.show({
        type: 'error',
        text1: options.errorMessage,
      });
    },

    onSuccess: (data: TData, variables: TVariables) => {
      options.onSuccess?.(data, variables);
    },

    onSettled: async (
      data: TData | undefined,
      error: Error | null,
      variables: TVariables,
      context: MutationContext | undefined,
    ) => {
      // Invalidate all updated keys
      if (context?.resolvedKeys) {
        for (const key of context.resolvedKeys) {
          await queryClient.invalidateQueries({ queryKey: key });
        }
      }

      // Invalidate additional keys if specified
      if (options.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          await queryClient.invalidateQueries({ queryKey: key });
        }
      }

      // Consumer callback passthrough
      options.onSettled?.(data, error, variables);
    },
  });
}

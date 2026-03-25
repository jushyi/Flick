import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { renderHook } from '@testing-library/react-native';

// Tests for SkeletonBase
describe('SkeletonBase', () => {
  let useShimmer: () => Animated.Value;
  let SkeletonShape: React.ComponentType<any>;

  beforeAll(() => {
    const mod = require('../../../src/components/skeletons/SkeletonBase');
    useShimmer = mod.useShimmer;
    SkeletonShape = mod.SkeletonShape;
  });

  describe('useShimmer', () => {
    it('returns an Animated.Value', () => {
      const { result } = renderHook(() => useShimmer());
      expect(result.current).toBeInstanceOf(Animated.Value);
    });
  });

  describe('SkeletonShape', () => {
    it('renders with testID', () => {
      const shimmerPosition = new Animated.Value(0);
      const { getByTestId } = render(
        <SkeletonShape
          width={100}
          height={20}
          shimmerPosition={shimmerPosition}
          testID="test-shape"
        />
      );
      expect(getByTestId('test-shape')).toBeTruthy();
    });

    it('has correct background color style', () => {
      const shimmerPosition = new Animated.Value(0);
      const { getByTestId } = render(
        <SkeletonShape
          width={100}
          height={20}
          shimmerPosition={shimmerPosition}
          testID="bg-shape"
        />
      );
      const shape = getByTestId('bg-shape');
      const flatStyle = Array.isArray(shape.props.style)
        ? Object.assign({}, ...shape.props.style.filter(Boolean))
        : shape.props.style;
      expect(flatStyle.backgroundColor).toBe('#252540');
    });
  });
});

// Tests for skeleton screen components
describe('Skeleton Screens', () => {
  it('FeedSkeleton renders without crashing', () => {
    const { FeedSkeleton } = require('../../../src/components/skeletons/FeedSkeleton');
    const { toJSON } = render(<FeedSkeleton />);
    expect(toJSON()).toBeTruthy();
  });

  it('ConversationsSkeleton renders 6 rows', () => {
    const { ConversationsSkeleton } = require('../../../src/components/skeletons/ConversationsSkeleton');
    const { getAllByTestId } = render(<ConversationsSkeleton />);
    expect(getAllByTestId(/^conv-row-/)).toHaveLength(6);
  });

  it('FriendsSkeleton renders friend row placeholders', () => {
    const { FriendsSkeleton } = require('../../../src/components/skeletons/FriendsSkeleton');
    const { getAllByTestId } = render(<FriendsSkeleton />);
    expect(getAllByTestId(/^friend-row-/)).toHaveLength(8);
  });

  it('CommentsSkeleton renders comment row placeholders', () => {
    const { CommentsSkeleton } = require('../../../src/components/skeletons/CommentsSkeleton');
    const { getAllByTestId } = render(<CommentsSkeleton />);
    expect(getAllByTestId(/^comment-row-/)).toHaveLength(5);
  });

  it('NotificationsSkeleton renders notification row placeholders', () => {
    const { NotificationsSkeleton } = require('../../../src/components/skeletons/NotificationsSkeleton');
    const { getAllByTestId } = render(<NotificationsSkeleton />);
    expect(getAllByTestId(/^notif-row-/)).toHaveLength(6);
  });
});

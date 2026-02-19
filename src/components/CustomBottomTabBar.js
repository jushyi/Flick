import { View, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { profileCacheKey } from '../utils/imageUtils';

const CustomBottomTabBar = ({ state, navigation, userProfile }) => {
  const insets = useSafeAreaInsets();
  const androidBottomPadding = Platform.OS === 'android' ? insets.bottom : 0;

  return (
    <View
      style={[
        styles.tabBar,
        androidBottomPadding > 0 && {
          paddingBottom: androidBottomPadding,
          height: 54 + androidBottomPadding,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const color = isFocused ? colors.icon.primary : colors.icon.inactive;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.jumpTo(route.name);
          }
        };

        let icon;
        if (route.name === 'Feed') {
          icon = <PixelIcon name="tab-feed" size={24} color={color} />;
        } else if (route.name === 'Camera') {
          icon = <PixelIcon name="tab-camera" size={24} color={color} />;
        } else if (route.name === 'Profile') {
          if (userProfile?.photoURL) {
            icon = (
              <Image
                source={{
                  uri: userProfile.photoURL,
                  cacheKey: profileCacheKey('profile-tab', userProfile.photoURL),
                }}
                style={[
                  styles.profilePhoto,
                  {
                    borderWidth: isFocused ? 2 : 1,
                    borderColor: isFocused ? color : 'transparent',
                  },
                ]}
                cachePolicy="memory-disk"
                transition={0}
              />
            );
          } else {
            icon = <PixelIcon name="tab-profile" size={24} color={color} />;
          }
        }

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabButton}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
          >
            {icon}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    height: Platform.OS === 'ios' ? 85 : 54,
    paddingBottom: Platform.OS === 'ios' ? 28 : 6,
    paddingTop: Platform.OS === 'android' ? 6 : 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePhoto: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});

export default CustomBottomTabBar;

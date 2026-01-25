import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const Tab = createMaterialTopTabNavigator();

/**
 * Notifications Tab - Placeholder for Phase 33-02
 */
const NotificationsTab = () => {
  return (
    <View style={styles.tabContainer}>
      <Text style={styles.placeholderText}>Notifications coming soon</Text>
    </View>
  );
};

/**
 * Friends Tab - Placeholder for Phase 33-02
 */
const FriendsTab = () => {
  return (
    <View style={styles.tabContainer}>
      <Text style={styles.placeholderText}>Friends coming soon</Text>
    </View>
  );
};

/**
 * Activity Screen - Two-tab structure for Notifications and Friends
 * Accessed via heart icon in feed header (Instagram-style Activity page)
 */
const ActivityScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Top Tab Navigator */}
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: styles.tabBar,
          tabBarIndicatorStyle: styles.tabIndicator,
          tabBarActiveTintColor: colors.text.primary,
          tabBarInactiveTintColor: colors.text.secondary,
          tabBarLabelStyle: styles.tabLabel,
          tabBarPressColor: 'transparent',
        }}
      >
        <Tab.Screen name="Notifications" component={NotificationsTab} />
        <Tab.Screen name="Friends" component={FriendsTab} />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 36, // Match back button width for centering
  },
  tabBar: {
    backgroundColor: colors.background.primary,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tabIndicator: {
    backgroundColor: colors.brand.purple,
    height: 2,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'none',
  },
  tabContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
});

export default ActivityScreen;

import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  permissionSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  permissionIcon: {
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  enableButton: {
    backgroundColor: colors.brand.purple,
    paddingVertical: 16,
    borderRadius: 4,
    marginTop: 24,
    width: '100%',
  },
  enableButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    textAlign: 'center',
  },
  skipButton: {
    paddingVertical: 16,
    marginTop: 12,
  },
  skipButtonText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    textAlign: 'center',
  },
});

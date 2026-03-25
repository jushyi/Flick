import * as Sentry from '@sentry/react-native';
import { reactNavigationIntegration } from '@sentry/react-native';

export const navigationIntegration = reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export function initSentry(): void {
  Sentry.init({
    dsn: '__DSN__', // TODO: Replace with actual Sentry DSN from dashboard
    environment: __DEV__ ? 'development' : 'production',
    enabled: !__DEV__,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    integrations: [navigationIntegration],
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      return breadcrumb;
    },
  });
}

export function setSentryUser(user: { id: string; username: string } | null): void {
  if (user) {
    Sentry.setUser({ id: user.id, username: user.username });
  } else {
    Sentry.setUser(null);
  }
}

export async function withTrace<T>(
  name: string,
  operation: () => Promise<T>,
  attributes?: Record<string, string>,
): Promise<T> {
  return Sentry.startSpan(
    { name, attributes },
    async (span) => {
      try {
        const result = await operation();
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }); // ERROR
        throw error;
      }
    },
  );
}

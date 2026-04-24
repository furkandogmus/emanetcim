import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/otp_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/booking/booking_detail_screen.dart';
import '../features/booking/my_bookings_screen.dart';
import '../features/checkout/checkout_screen.dart';
import '../features/home/home_shell.dart';
import '../features/admin/admin_dashboard_screen.dart';
import '../features/admin/admin_applications_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/partner/partner_bookings_screen.dart';
import '../features/partner/partner_earnings_screen.dart';
import '../features/partner/partner_settings_screen.dart';
import '../features/partner/partner_booking_detail_screen.dart';
import '../features/partner/partner_scan_screen.dart';
import '../shared/models/user.dart';
import '../features/home/home_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/search/search_screen.dart';
import '../features/search/shop_detail_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final loggedIn = auth.session != null;
      final loggingIn = state.matchedLocation.startsWith('/auth');
      final isPartnerRoute = state.matchedLocation.startsWith('/partner');
      final isAdminRoute = state.matchedLocation.startsWith('/admin');
      final role = auth.session?.role;

      if (!auth.onboardingDone && state.matchedLocation != '/onboarding') {
        return '/onboarding';
      }

      if (!loggedIn && !loggingIn && state.matchedLocation != '/onboarding') {
        return '/auth/login';
      }

      if (loggedIn) {
        if (loggingIn) {
          if (role == UserRole.admin) return '/admin';
          if (role == UserRole.partner) return '/partner';
          return '/';
        }

        // Security: Prevent cross-role access
        if (role == UserRole.admin &&
            !isAdminRoute &&
            state.matchedLocation == '/') {
          return '/admin';
        }
        if (role == UserRole.partner &&
            !isPartnerRoute &&
            state.matchedLocation == '/') {
          return '/partner';
        }
        if (role == UserRole.guest && (isPartnerRoute || isAdminRoute)) {
          return '/';
        }
        if (role == UserRole.partner && isAdminRoute) {
          return '/partner';
        }
      }
      return null;
    },
    routes: [
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/auth/login', builder: (_, _) => const LoginScreen()),
      GoRoute(
        path: '/auth/register',
        builder: (_, _) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/auth/otp',
        builder: (_, s) => OtpScreen(
          identity:
              s.uri.queryParameters['email'] ??
              s.uri.queryParameters['identity'] ??
              '',
        ),
      ),

      ShellRoute(
        builder: (_, _, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
          GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
          GoRoute(
            path: '/bookings',
            builder: (_, _) => const MyBookingsScreen(),
          ),
          GoRoute(
            path: '/notifications',
            builder: (_, _) => const NotificationsScreen(),
          ),
          GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
          GoRoute(
            path: '/partner',
            builder: (_, _) => const PartnerBookingsScreen(),
          ),
          GoRoute(
            path: '/admin',
            builder: (_, _) => const AdminDashboardScreen(),
          ),
          GoRoute(
            path: '/admin/applications',
            builder: (_, _) => const AdminApplicationsScreen(),
          ),
        ],
      ),

      GoRoute(
        path: '/shop/:id',
        builder: (_, s) => ShopDetailScreen(shopId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/booking/:id',
        builder: (_, s) =>
            BookingDetailScreen(bookingId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/partner/booking/:id',
        builder: (_, s) =>
            PartnerBookingDetailScreen(bookingId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/partner/earnings',
        builder: (_, _) => const PartnerEarningsScreen(),
      ),
      GoRoute(
        path: '/partner/settings',
        builder: (_, _) => const PartnerSettingsScreen(),
      ),
      GoRoute(
        path: '/checkout/:shopId',
        builder: (_, s) => CheckoutScreen(shopId: s.pathParameters['shopId']!),
      ),
      GoRoute(
        path: '/partner/scan',
        builder: (_, _) => const PartnerScanScreen(),
      ),
    ],
  );
});

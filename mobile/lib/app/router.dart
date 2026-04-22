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
import '../features/notifications/notifications_screen.dart';
import '../features/partner/partner_bookings_screen.dart';
import '../features/partner/partner_booking_detail_screen.dart';
import '../features/partner/partner_scan_screen.dart';
import '../shared/models/user.dart';
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

      if (!loggedIn && !loggingIn) return '/auth/login';
      
      if (loggedIn) {
        if (loggingIn) {
          if (role == UserRole.ADMIN) return '/admin';
          if (role == UserRole.PARTNER) return '/partner';
          return '/';
        }
        
        // Security: Prevent cross-role access
        if (role == UserRole.ADMIN && !isAdminRoute && state.matchedLocation == '/') return '/admin';
        if (role == UserRole.PARTNER && !isPartnerRoute && state.matchedLocation == '/') return '/partner';
        if (role == UserRole.GUEST && (isPartnerRoute || isAdminRoute)) return '/';
        if (role == UserRole.PARTNER && isAdminRoute) return '/partner';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/auth/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/auth/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/auth/otp', builder: (_, s) => OtpScreen(identity: s.uri.queryParameters['email'] ?? s.uri.queryParameters['identity'] ?? '')),

      ShellRoute(
        builder: (_, __, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const SearchScreen()),
          GoRoute(path: '/bookings', builder: (_, __) => const MyBookingsScreen()),
          GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          GoRoute(path: '/partner', builder: (_, __) => const PartnerBookingsScreen()),
          GoRoute(path: '/admin', builder: (_, __) => const AdminDashboardScreen()),
        ],
      ),

      GoRoute(path: '/shop/:id', builder: (_, s) => ShopDetailScreen(shopId: s.pathParameters['id']!)),
      GoRoute(path: '/booking/:id', builder: (_, s) => BookingDetailScreen(bookingId: s.pathParameters['id']!)),
      GoRoute(path: '/partner/booking/:id', builder: (_, s) => PartnerBookingDetailScreen(bookingId: s.pathParameters['id']!)),
      GoRoute(path: '/checkout/:shopId', builder: (_, s) => CheckoutScreen(shopId: s.pathParameters['shopId']!)),
      GoRoute(path: '/partner/scan', builder: (_, __) => const PartnerScanScreen()),
    ],
  );
});

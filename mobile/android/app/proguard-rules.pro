# Flutter core
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.ViewUtils { *; }
-keep class io.flutter.view.** { *; }

# Services/Plugins that use reflection or native callbacks
-keep class com.google.firebase.** { *; }
-keep class com.stripe.android.** { *; }
-keep class com.easy_localization.** { *; }

# Don't warn about missing references in these heavy SDKs
-dontwarn com.google.firebase.**
-dontwarn com.stripe.**
-dontwarn androidx.window.layout.SidecarHelper
-dontwarn androidx.window.sidecar.SidecarInterface
-dontwarn androidx.window.sidecar.SidecarDeviceState

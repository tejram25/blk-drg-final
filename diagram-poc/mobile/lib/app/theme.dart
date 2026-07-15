import 'package:flutter/material.dart';

/// Light and dark themes for the app, keyed off a single seed color so the
/// Material 3 palette stays consistent. The dark canvas tones mirror the web
/// editor (background #0e0f11, surface #141518).
class AppTheme {
  const AppTheme._();

  static const Color _seed = Color(0xFF1D4ED8); // blue-700, the brand accent
  static const Color _accent = Color(0xFFF5A623); // amber highlight for parts

  static ThemeData get light => _base(Brightness.light);
  static ThemeData get dark => _base(Brightness.dark);

  static ThemeData _base(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: _seed,
      brightness: brightness,
      secondary: _accent,
    ).copyWith(
      surface: isDark ? const Color(0xFF141518) : Colors.white,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor:
          isDark ? const Color(0xFF0E0F11) : const Color(0xFFF6F7F9),
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        centerTitle: false,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        isDense: true,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: scheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),
    );
  }
}

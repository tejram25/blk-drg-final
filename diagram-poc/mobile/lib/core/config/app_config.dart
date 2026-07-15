/// Runtime configuration for the app.
///
/// The Spring Boot service in `diagram-poc/backend` acts as the
/// Backend-for-Frontend (BFF): it already aggregates the domain services and
/// exposes a REST API tailored to a single client, which is exactly what this
/// mobile app consumes. Override the base URL at build time with:
///
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8080
class AppConfig {
  const AppConfig._();

  /// Base URL of the BFF.
  ///
  /// Defaults target a local backend:
  ///  - Android emulator reaches the host machine via 10.0.2.2
  ///  - iOS simulator reaches it via localhost
  /// On a physical device, pass your machine's LAN IP with --dart-define.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  /// Prefix every REST route carries in the backend controllers.
  static const String apiPrefix = '/api';

  /// Network timeouts.
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  static String get apiRoot => '$apiBaseUrl$apiPrefix';
}

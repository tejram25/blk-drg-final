import 'package:dio/dio.dart';

/// A normalized error surfaced to the UI layer, so screens never depend on Dio.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isUnauthorized => statusCode == 401 || statusCode == 403;

  @override
  String toString() => message;

  /// Translate a low-level Dio failure into a user-facing message.
  factory ApiException.fromDio(DioException e) {
    final code = e.response?.statusCode;

    // The backend returns { "message": "..." } on handled errors.
    final data = e.response?.data;
    if (data is Map && data['message'] is String) {
      return ApiException(data['message'] as String, statusCode: code);
    }

    final message = switch (e.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout =>
        'The server took too long to respond.',
      DioExceptionType.connectionError =>
        'Could not reach the server. Check your connection and the API URL.',
      DioExceptionType.badCertificate => 'The server certificate is invalid.',
      DioExceptionType.cancel => 'Request cancelled.',
      _ => switch (code ?? 0) {
          401 || 403 => 'Your session has expired. Please sign in again.',
          404 => 'Not found.',
          409 => 'That conflicts with something that already exists.',
          >= 500 => 'The server ran into a problem. Please try again.',
          _ => 'Something went wrong. Please try again.',
        },
    };
    return ApiException(message, statusCode: code);
  }
}

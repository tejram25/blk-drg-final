import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';

import '../config/app_config.dart';
import 'api_exception.dart';

/// Thin wrapper over Dio that talks to the BFF.
///
/// The backend authenticates with a server-side session cookie (JSESSIONID),
/// so the client must persist and replay cookies across requests and app
/// restarts. A [PersistCookieJar] backed by the app's documents directory does
/// exactly that.
class ApiClient {
  ApiClient._(this._dio, this._cookieJar);

  final Dio _dio;
  final PersistCookieJar _cookieJar;

  Dio get raw => _dio;

  static Future<ApiClient> create() async {
    final dir = await getApplicationDocumentsDirectory();
    final cookieJar = PersistCookieJar(
      storage: FileStorage('${dir.path}/.cookies'),
    );

    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiRoot,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        contentType: Headers.jsonContentType,
        // Let us inspect non-2xx responses instead of throwing immediately;
        // ApiException.fromDio maps them to friendly messages.
        validateStatus: (status) => status != null && status < 500,
      ),
    );
    dio.interceptors.add(CookieManager(cookieJar));

    return ApiClient._(dio, cookieJar);
  }

  /// Drop the session cookie (used on logout).
  Future<void> clearCookies() => _cookieJar.deleteAll();

  Future<Response<T>> getJson<T>(
    String path, {
    Map<String, dynamic>? query,
  }) =>
      _guard(() => _dio.get<T>(path, queryParameters: query));

  Future<Response<T>> postJson<T>(String path, {Object? body}) =>
      _guard(() => _dio.post<T>(path, data: body));

  Future<Response<T>> putJson<T>(String path, {Object? body}) =>
      _guard(() => _dio.put<T>(path, data: body));

  Future<Response<T>> deleteJson<T>(String path) =>
      _guard(() => _dio.delete<T>(path));

  Future<Response<T>> _guard<T>(Future<Response<T>> Function() call) async {
    try {
      final res = await call();
      final code = res.statusCode ?? 0;
      if (code >= 400) {
        final data = res.data;
        final message = (data is Map && data['message'] is String)
            ? data['message'] as String
            : 'Request failed ($code).';
        throw ApiException(message, statusCode: code);
      }
      return res;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

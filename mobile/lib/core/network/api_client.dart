import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:mime/mime.dart';

import '../env/env.dart';
import 'session_store.dart';

/// Thrown for any non-2xx response from the backend. [message] is the
/// Indonesian-language message the API already returns in `body.message`,
/// so it can be shown to the user as-is (see utils/response.js on the
/// backend: `{ success, message, data|errors }`).
class ApiException implements Exception {
  final int statusCode;
  final String message;
  final Map<String, dynamic>? errors;
  ApiException(this.statusCode, this.message, {this.errors});

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Talks to the backend REST API (Express + PostgreSQL).
///
/// Base URL comes from `.env` -> API_BASE_URL (see core/env/env.dart).
/// - Android emulator reaching a backend on your machine: `http://10.0.2.2:5000`
/// - iOS simulator: `http://localhost:5000`
/// - Physical device on the same Wi-Fi: `http://[ip-lan-komputer]:5000`
///
/// Every call automatically attaches `Authorization: Bearer <accessToken>`
/// once a session exists, and transparently retries once via
/// POST /auth/refresh-token if a request comes back 401.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  /// API_BASE_URL di .env boleh diisi dengan atau tanpa akhiran `/api`.
  /// Normalisasi di sini supaya tidak pernah menjadi `<host>/api/api/...`
  /// — kesalahan itu membuat SEMUA request 404, termasuk pendaftaran token
  /// push ke POST /api/push/register sehingga notif bar tidak pernah muncul.
  ///
  /// Publik supaya pesan error koneksi (mis. AuthProvider) menampilkan URL
  /// yang benar-benar dicoba, bukan alamat hardcode yang bisa usang.
  String get baseUrl {
    final raw = Env.apiBaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
    return raw.endsWith('/api') ? raw : '$raw/api';
  }

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final normalizedQuery =
        query?.map((k, v) => MapEntry(k, v?.toString())) ?? const {};
    return Uri.parse('$baseUrl$cleanPath').replace(
        queryParameters: normalizedQuery.isEmpty ? null : normalizedQuery);
  }

  Future<Map<String, String>> _headers({bool json = true}) async {
    final token = await SessionStore.getAccessToken();
    return {
      if (json) 'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _send('GET', path, query: query);

  Future<dynamic> post(String path, {Object? body}) =>
      _send('POST', path, body: body);

  Future<dynamic> put(String path, {Object? body}) =>
      _send('PUT', path, body: body);

  Future<dynamic> patch(String path, {Object? body}) =>
      _send('PATCH', path, body: body);

  Future<dynamic> delete(String path) => _send('DELETE', path);

  /// multipart/form-data upload, used by POST /leaves (lampiran .pdf/.docx).
  Future<dynamic> postMultipart(
    String path, {
    required Map<String, String> fields,
    File? file,
    String fileField = 'file',
    bool isRetry = false,
  }) async {
    final request = http.MultipartRequest('POST', _uri(path));
    final token = await SessionStore.getAccessToken();
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    request.fields.addAll(fields);

    if (file != null) {
      // IMPORTANT: without an explicit contentType, http.MultipartFile
      // defaults every upload to application/octet-stream regardless of
      // the file's real extension. The backend's mimetype allow-list then
      // rejects it with "Format file tidak didukung" even for a valid
      // .pdf/.docx. Look the real MIME type up from the filename instead.
      final mimeType = lookupMimeType(file.path) ?? 'application/octet-stream';
      request.files.add(
        await http.MultipartFile.fromPath(
          fileField,
          file.path,
          contentType: MediaType.parse(mimeType),
        ),
      );
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    // Access token expired -> refresh once, then retry. This was missing
    // entirely before: unlike _send(), a multipart upload never retried
    // after a 401, so an expired access token silently killed every
    // "Ajukan Izin & Cuti" submission.
    if (response.statusCode == 401 && !isRetry) {
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        return postMultipart(
          path,
          fields: fields,
          file: file,
          fileField: fileField,
          isRetry: true,
        );
      }
    }

    return _decode(response);
  }

  Future<dynamic> _send(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
    bool isRetry = false,
  }) async {
    final uri = _uri(path, query);
    final headers = await _headers();
    final encodedBody = body == null ? null : jsonEncode(body);

    late http.Response response;
    switch (method) {
      case 'GET':
        response = await http.get(uri, headers: headers);
        break;
      case 'POST':
        response = await http.post(uri, headers: headers, body: encodedBody);
        break;
      case 'PUT':
        response = await http.put(uri, headers: headers, body: encodedBody);
        break;
      case 'PATCH':
        response = await http.patch(uri, headers: headers, body: encodedBody);
        break;
      case 'DELETE':
        response = await http.delete(uri, headers: headers);
        break;
    }

    // Access token expired (JWT_EXPIRES_IN) -> refresh once, then retry.
    if (response.statusCode == 401 && !isRetry) {
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        return _send(method, path, query: query, body: body, isRetry: true);
      }
    }

    return _decode(response);
  }

  Future<bool> _tryRefreshToken() async {
    final refreshToken = await SessionStore.getRefreshToken();
    if (refreshToken == null) return false;
    try {
      final response = await http.post(
        _uri('/auth/refresh-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refreshToken}),
      );
      final decoded = _decode(response);
      final newToken = decoded['data']?['accessToken'] as String?;
      if (newToken == null) return false;
      await SessionStore.saveAccessToken(newToken);
      return true;
    } catch (_) {
      return false;
    }
  }

  dynamic _decode(http.Response response) {
    Map<String, dynamic> body;
    try {
      body = response.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      body = <String, dynamic>{};
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    throw ApiException(
      response.statusCode,
      body['message'] as String? ?? 'Terjadi kesalahan. Coba lagi.',
      errors: body['errors'] as Map<String, dynamic>?,
    );
  }
}

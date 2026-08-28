// URLSession-based API client. One place for auth, error mapping and JSON.
import Foundation

enum ApiError: LocalizedError {
    case invalidURL
    case http(Int, code: String, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Bad request"
        case .http(_, _, let message): return message
        }
    }

    /// Stable machine-readable code (e.g. APPOINTMENT_SLOT_UNAVAILABLE).
    var code: String {
        if case .http(_, let code, _) = self { return code }
        return "ERROR"
    }
}

actor TokenStore {
    static let shared = TokenStore()
    private let key = "nb_auth_token"

    func token() -> String? { UserDefaults.standard.string(forKey: key) }

    func save(_ token: String) { UserDefaults.standard.set(token, forKey: key) }

    func clear() { UserDefaults.standard.removeObject(forKey: key) }
}

struct APIClient {
    /// Tenant endpoint. The ONLY tenant-specific value compiled into the app
    /// (white-label Model B). Override per build configuration if desired.
    var baseURL: URL

    init(base urlString: String = ProcessInfo.processInfo.environment["NB_API_URL"] ?? "http://localhost:3000/api/v1") {
        self.baseURL = URL(string: urlString) ?? URL(string: "http://localhost:3000/api/v1")!
    }

    func request<T: Decodable>(_ type: T.Type, _ path: String, method: String = "GET", body: Encodable? = nil) async throws -> T {
        let (data, _) = try await perform(path, method: method, body: body)
        return try JSONDecoder().decode(T.self, from: data)
    }

    /// For endpoints returning 204/no meaningful body.
    func send(_ path: String, method: String, body: Encodable? = nil) async throws {
        _ = try await perform(path, method: method, body: body)
    }

    private func perform(_ path: String, method: String, body: Encodable?) async throws -> (Data, HTTPURLResponse) {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw ApiError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        if let token = await TokenStore.shared.token() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        }
        if let body {
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ApiError.invalidURL }

        guard (200...299).contains(http.statusCode) else {
            let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data)
            throw ApiError.http(
                http.statusCode,
                code: envelope?.error.code ?? "ERROR",
                message: envelope?.error.message ?? friendlyMessage(for: http.statusCode),
            )
        }
        return (data, http)
    }

    private func friendlyMessage(for status: Int) -> String {
        switch status {
        case 401: return "Please sign in again."
        case 403: return "You don't have access to that."
        case 404: return "Not found."
        default: return "Something went wrong. Please try again."
        }
    }
}

/// Type-eraser so `body: Encodable?` works with concrete Codable structs.
private struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void
    init(_ wrapped: Encodable) {
        encodeFunc = wrapped.encode
    }
    func encode(to encoder: Encoder) throws {
        try encodeFunc(encoder)
    }
}

// APNs registration + device-token binding. Tokens bind server-side to the
// signed-in customer (POST /devices) and are never a permanent identity.
import SwiftUI
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil,
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await PushRegistrar.bind(tokenData: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Push is best-effort; never block the app on it.
    }
}

enum PushRegistrar {
    static func requestAuthorization() async {
        let center = UNUserNotificationCenter.current()
        _ = try? await center.requestAuthorization(options: [.alert, .badge, .sound])
        await MainActor.run {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    static func bind(tokenData: Data) async {
        guard await TokenStore.shared.token() != nil else { return } // bind after login instead
        let api = APIClient()
        _ = try? await api.send("devices", method: "POST", body: ["fcmToken": tokenData.hexString, "platform": "ios"])
    }
}

extension Data {
    var hexString: String { map { String(format: "%02x", $0) }.joined() }
}

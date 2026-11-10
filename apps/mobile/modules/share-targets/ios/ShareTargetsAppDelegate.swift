import ExpoModulesCore
import TikTokOpenSDKCore

/// Hands TikTok's return to its SDK, which finishes the share request. React
/// Native sees the same link; +native-intent.tsx keeps it from routing.
public class ShareTargetsAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return TikTokURLHandler.handleOpenURL(url)
  }

  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    // Expo waits for every subscriber to call this before it calls the real one.
    restorationHandler(nil)
    return TikTokURLHandler.handleOpenURL(userActivity.webpageURL)
  }
}

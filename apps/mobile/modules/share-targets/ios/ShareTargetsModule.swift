import ExpoModulesCore
import Photos
import TikTokOpenSDKCore
import TikTokOpenShareSDK
import UIKit

public class ShareTargetsModule: Module {
  /// TikTok's SDK holds requests weakly, so the response needs this one.
  private var tikTokRequest: TikTokShareRequest?
  private var tikTokPromise: Promise?

  public func definition() -> ModuleDefinition {
    Name("ShareTargets")

    // From Info.plist, which the config plugin fills at prebuild. A build made
    // with no key has no TikTok URL scheme, so the button has to stay hidden.
    Constant("tikTokConfigured") { () -> Bool in
      let key = Bundle.main.object(forInfoDictionaryKey: "TikTokClientKey") as? String
      return !(key ?? "").isEmpty
    }

    // Meta's flow: check the scheme, put the sticker and colors on the
    // pasteboard for five minutes, open Instagram.
    AsyncFunction("shareToInstagramStories") { (imageUrl: URL, appId: String, backgroundColor: String) -> Bool in
      guard
        let scheme = URL(string: "instagram-stories://share?source_application=\(appId)"),
        UIApplication.shared.canOpenURL(scheme),
        let image = try? Data(contentsOf: imageUrl)
      else {
        return false
      }
      let items: [[String: Any]] = [[
        "com.instagram.sharedSticker.stickerImage": image,
        "com.instagram.sharedSticker.backgroundTopColor": backgroundColor,
        "com.instagram.sharedSticker.backgroundBottomColor": backgroundColor,
      ]]
      UIPasteboard.general.setItems(items, options: [.expirationDate: Date().addingTimeInterval(60 * 5)])
      UIApplication.shared.open(scheme)
      return true
    }.runOnQueue(.main)

    // TikTok takes Photos identifiers, never file paths, so the card is saved
    // to Photos first. Add-only access is enough to write it and get the
    // identifier; the prompt appears on the first share and not before.
    // Resolves when TikTok returns, which may be never, so callers must not
    // hold anything open on it.
    AsyncFunction("shareToTikTok") { (imageUrl: URL, redirectUri: String, promise: Promise) in
      PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
        guard status == .authorized || status == .limited else {
          promise.resolve(["status": "denied"])
          return
        }
        var identifier: String?
        PHPhotoLibrary.shared().performChanges({
          let request = PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: imageUrl)
          identifier = request?.placeholderForCreatedAsset?.localIdentifier
        }) { saved, _ in
          DispatchQueue.main.async {
            guard saved, let identifier else {
              promise.resolve(["status": "failed"])
              return
            }
            self.send(identifier: identifier, redirectUri: redirectUri, promise: promise)
          }
        }
      }
    }
  }

  private func send(identifier: String, redirectUri: String, promise: Promise) {
    finishTikTok(["status": "replaced"])
    let request = TikTokShareRequest(localIdentifiers: [identifier], mediaType: .image, redirectURI: redirectUri)
    tikTokRequest = request
    tikTokPromise = promise
    let sent = request.send { [weak self] response in
      guard let response = response as? TikTokShareResponse else {
        self?.finishTikTok(["status": "failed"])
        return
      }
      let status: String
      switch response.errorCode {
      case .noError: status = "shared"
      case .cancelled: status = "cancelled"
      default: status = "failed"
      }
      self?.finishTikTok([
        "status": status,
        "errorCode": response.errorCode.rawValue,
        "shareState": response.shareState.rawValue,
      ])
    }
    if !sent {
      finishTikTok(["status": "failed"])
    }
  }

  private func finishTikTok(_ result: [String: Any]) {
    tikTokPromise?.resolve(result)
    tikTokPromise = nil
    tikTokRequest = nil
  }
}

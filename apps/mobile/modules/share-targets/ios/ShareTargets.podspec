Pod::Spec.new do |s|
  s.name           = 'ShareTargets'
  s.version        = '1.0.0'
  s.summary        = 'Sends a share card to Instagram Stories and TikTok.'
  s.description    = 'Sends a share card to Instagram Stories and TikTok.'
  s.license        = 'UNLICENSED'
  s.author         = 'LiftCamp'
  s.homepage       = 'https://liftcamp.app'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Pinned: both are on CocoaPods trunk, which stops taking new versions on
  # 2 Dec 2026. TikTok also publishes these through Swift Package Manager.
  s.dependency 'TikTokOpenSDKCore', '2.5.0'
  s.dependency 'TikTokOpenShareSDK', '2.5.0'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end

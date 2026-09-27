// Builds the launch logo: the app icon as a rounded tile with the
// "LiftCamp" wordmark in Outfit under it, one image for light mode and one
// for dark. The native splash is the background color alone; these are
// drawn by src/components/launch-overlay.tsx, which drops them in.
//
// TERMINAL, from the repo root:
//   swift apps/mobile/assets-src/splash/make-splash.swift
//
// Reads  apps/mobile/assets/images/icon.png (the full-bleed app icon) and
//        Outfit Bold from @expo-google-fonts/outfit.
// Writes apps/mobile/assets/images/splash-wordmark.png and
//        splash-wordmark-dark.png, transparent around the tile and the
//        text, so the splash background color shows through in both modes.
//
// The tile is cut from icon.png here rather than taken from splash-icon.png,
// because splash-icon.png sits on opaque white, which shows as a white
// square on the dark splash.
//
// The logo is temporary. Replace icon.png and rerun. The images are bundled
// JS assets, so a new JS bundle picks them up; no native rebuild needed.
//
// macOS only, and nothing to install: CoreGraphics and CoreText ship with it.

import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

// #filePath is relative when the script is run by a relative path, so
// anchor it to the working directory before walking up from it.
let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
let mobile = URL(fileURLWithPath: #filePath, relativeTo: cwd).absoluteURL
  .deletingLastPathComponent()
  .appendingPathComponent("../..")
  .standardized
let iconURL = mobile.appendingPathComponent("assets/images/icon.png")
let fontURL = mobile
  .appendingPathComponent("../../node_modules/@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf")
  .standardized

let wordmark = "LiftCamp"

/// Output width in pixels. app.json's imageWidth scales it on screen.
let canvasW = 1024
/// The tile's side as a share of the canvas width, matching the tile in the
/// old splash-icon.png (744 of 1024), so the mark keeps its on-screen size.
let tileShare: CGFloat = 744.0 / 1024.0
/// Corner radius as a share of the tile's side, the iOS app icon's.
let cornerShare: CGFloat = 0.2237
/// Wordmark width as a share of the tile's side.
let wordmarkShare: CGFloat = 0.8
/// Gap between the tile and the wordmark, as a share of the tile's side.
let gapShare: CGFloat = 0.1

/// Chalk graphite on paper for light mode, paper on graphite for dark.
let variants: [(file: String, text: CGColor)] = [
  ("splash-wordmark.png", CGColor(srgbRed: 0x22 / 255, green: 0x1F / 255, blue: 0x1B / 255, alpha: 1)),
  ("splash-wordmark-dark.png", CGColor(srgbRed: 0xFD / 255, green: 0xFC / 255, blue: 0xFB / 255, alpha: 1)),
]

func fail(_ message: String) -> Never {
  FileHandle.standardError.write("make-splash: \(message)\n".data(using: .utf8)!)
  exit(1)
}

let rgb = CGColorSpace(name: CGColorSpace.sRGB)!
let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue

func context(width: Int, height: Int) -> CGContext {
  guard
    let ctx = CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
      space: rgb, bitmapInfo: bitmapInfo)
  else { fail("cannot make a \(width)x\(height) canvas") }
  ctx.interpolationQuality = .high
  ctx.textMatrix = .identity
  return ctx
}

// MARK: Inputs

guard let source = CGImageSourceCreateWithURL(iconURL as CFURL, nil),
  let icon = CGImageSourceCreateImageAtIndex(source, 0, nil)
else { fail("cannot read \(iconURL.path)") }

guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(fontURL as CFURL) as? [CTFontDescriptor],
  let descriptor = descriptors.first
else { fail("cannot read \(fontURL.path); run pnpm install first") }

func line(size: CGFloat, color: CGColor) -> CTLine {
  let font = CTFontCreateWithFontDescriptor(descriptor, size, nil)
  let attributes: [NSAttributedString.Key: Any] = [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
  ]
  return CTLineCreateWithAttributedString(NSAttributedString(string: wordmark, attributes: attributes))
}

/// Glyph bounds relative to the baseline origin, measured against a real
/// bitmap context; a nil context under-reports them.
let measure = context(width: 1, height: 1)
func glyphBounds(size: CGFloat) -> CGRect {
  measure.textPosition = .zero
  return CTLineGetImageBounds(line(size: size, color: variants[0].text), measure)
}

// MARK: Layout
//
// Top-left coordinates. The padding above the tile is repeated below the
// wordmark, so the pair is centred as a group on the splash.

let tile = (CGFloat(canvasW) * tileShare).rounded()
let pad = ((CGFloat(canvasW) - tile) / 2).rounded()
let gap = (tile * gapShare).rounded()
let fontSize = 100 * (tile * wordmarkShare) / glyphBounds(size: 100).width
let text = glyphBounds(size: fontSize)
let canvasH = Int((pad + tile + gap + text.height + pad).rounded(.up))

for variant in variants {
  let ctx = context(width: canvasW, height: canvasH)
  ctx.clear(CGRect(x: 0, y: 0, width: canvasW, height: canvasH))

  // CoreGraphics measures y from the bottom.
  let tileRect = CGRect(x: pad, y: CGFloat(canvasH) - pad - tile, width: tile, height: tile)
  ctx.saveGState()
  ctx.addPath(CGPath(
    roundedRect: tileRect, cornerWidth: tile * cornerShare, cornerHeight: tile * cornerShare,
    transform: nil))
  ctx.clip()
  ctx.draw(icon, in: tileRect)
  ctx.restoreGState()

  // The wordmark's glyph box starts `gap` under the tile, centred across.
  let glyphTop = tileRect.minY - gap
  ctx.textPosition = CGPoint(
    x: (CGFloat(canvasW) - text.width) / 2 - text.minX,
    y: glyphTop - text.maxY)
  CTLineDraw(line(size: fontSize, color: variant.text), ctx)

  guard let image = ctx.makeImage() else { fail("cannot render \(variant.file)") }
  let out = mobile.appendingPathComponent("assets/images/\(variant.file)")
  guard let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)
  else { fail("cannot write \(out.path)") }
  CGImageDestinationAddImage(dest, image, nil)
  if !CGImageDestinationFinalize(dest) { fail("cannot write \(out.path)") }
  print("wrote \(out.path) (\(canvasW)x\(canvasH), Outfit Bold \(Int(fontSize.rounded())) px)")
}

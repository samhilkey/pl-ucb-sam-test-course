// Step 4A feasibility probe only. No curve extraction or calibration decisions.
// macOS Vision performs recognition on-device; no networking code is used.
import Foundation
import Vision
import ImageIO

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: probe-ocr <image.png>\n", stderr)
    exit(2)
}
do {
    let url = URL(fileURLWithPath: CommandLine.arguments[1])
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "OCRProbe", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Cannot decode image"])
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = false
    let started = Date()
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    let observations: [[String: Any]] = (request.results ?? []).map { observation in
        let box = observation.boundingBox
        // Vision uses a bottom-left normalized frame; export top-left pixel edges.
        let bounds = [box.minX * Double(image.width),
                      (1 - box.maxY) * Double(image.height),
                      box.maxX * Double(image.width),
                      (1 - box.minY) * Double(image.height)]
        return ["bounds_pixel_edges": bounds,
                "candidates": observation.topCandidates(3).map {
                    ["text": $0.string, "engine_confidence": $0.confidence] as [String: Any]
                }]
    }
    let result: [String: Any] = [
        "status": "completed_feasibility_probe",
        "engine": "Apple Vision VNRecognizeTextRequest",
        "request_revision": request.revision,
        "recognition_level": "accurate", "languages": ["en-US"],
        "language_correction": false,
        "image": ["width": image.width, "height": image.height],
        "coordinate_frame": "top_left_xy_pixel_edges",
        "duration_ms": Date().timeIntervalSince(started) * 1000,
        "observations": observations,
        "interpretation": "Raw OCR only; confidence is not calibrated accuracy. No labels accepted for calibration."
    ]
    let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
} catch {
    fputs("OCR probe failed: \(error)\n", stderr)
    exit(1)
}

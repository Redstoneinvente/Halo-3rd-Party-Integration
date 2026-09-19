import AppKit
import Foundation

struct HaloRequest: Decodable {
    let protocolVersion: Int
    let requestID: String
    let sourceBundleIdentifier: String
    let action: String?
    let actionID: String?
    let options: [String: JSONValue]

    var resolvedActionID: String {
        actionID ?? action ?? ""
    }
}

enum JSONValue: Decodable {
    case string(String)
    case integer(Int)
    case double(Double)
    case boolean(Bool)
    case stringArray([String])
    case integerArray([Int])
    case doubleArray([Double])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let value = try? container.decode(Bool.self) {
            self = .boolean(value)
        } else if let value = try? container.decode(Int.self) {
            self = .integer(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String].self) {
            self = .stringArray(value)
        } else if let value = try? container.decode([Int].self) {
            self = .integerArray(value)
        } else if let value = try? container.decode([Double].self) {
            self = .doubleArray(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported Halo option value"
            )
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    // Launch Services can deliver the .halorequest and input files in separate
    // application(_:open:) callbacks. Briefly batch them before processing.
    private var pendingURLs: [URL] = []
    private var pendingWorkItem: DispatchWorkItem?

    func application(_ application: NSApplication, open urls: [URL]) {
        pendingURLs.append(contentsOf: urls)

        pendingWorkItem?.cancel()
        let workItem = DispatchWorkItem { [weak self] in
            self?.processPendingHaloOpen()
        }
        pendingWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15, execute: workItem)
    }

    private func processPendingHaloOpen() {
        let urls = pendingURLs
        pendingURLs.removeAll()
        pendingWorkItem = nil

        let requestURLs = urls.filter {
            $0.pathExtension.lowercased() == "halorequest"
        }
        let inputFiles = urls.filter {
            $0.pathExtension.lowercased() != "halorequest"
        }

        guard let requestURL = requestURLs.first else {
            return
        }

        do {
            let started = requestURL.startAccessingSecurityScopedResource()
            defer {
                if started {
                    requestURL.stopAccessingSecurityScopedResource()
                }
            }

            let data = try Data(contentsOf: requestURL)
            let request = try JSONDecoder().decode(HaloRequest.self, from: data)

            switch request.resolvedActionID {
            case "convert.image":
                try handleConvertImage(files: inputFiles, options: request.options)

            case "compress":
                try handleCompress(files: inputFiles, options: request.options)

            default:
                print("Unknown Halo action:", request.resolvedActionID)
            }
        } catch {
            print("Halo request failed:", error)
        }
    }

    private func handleConvertImage(
        files: [URL],
        options: [String: JSONValue]
    ) throws {
        print("Halo requested convert.image")
        print("Files:", files)
        print("Options:", options)

        // Perform your application's real action here.
    }

    private func handleCompress(
        files: [URL],
        options: [String: JSONValue]
    ) throws {
        print("Halo requested compress")
        print("Files:", files)
        print("Options:", options)

        // Perform your application's real action here.
    }
}

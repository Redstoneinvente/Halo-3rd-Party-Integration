;(function v2Patch() {
  state.protocolVersion = 2;
  state.triggers = [];

  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
  const EXT_RE = /^[a-z0-9][a-z0-9+_-]*$/;
  const MAX_BYTES = 256000;
  const MAX_ACTIONS = 64;
  const MAX_OPTIONS = 32;
  const MAX_TRIGGERS = 32;
  const OPTION_TYPES = optionTypes.map(([value]) => value);
  const TRIGGER_TYPES = ["fileDrag", "keyboardShortcut", "manual", "partnerEvent"];

  const v2Example = {
    protocolVersion: 2,
    app: { name: "File Converter", bundleIdentifier: "com.yourcompany.fileconverter" },
    actions: [
      {
        id: "convert.image",
        name: "Convert Image",
        input: { type: "files", extensions: ["jpg", "jpeg", "heic", "webp"], multiple: true },
        options: [
          { key: "format", name: "Output format", type: "string", required: true, description: "Requested output format, for example png or jpeg." },
          { key: "quality", name: "Quality", type: "double", required: false, default: 0.9, description: "Compression quality from 0.0 to 1.0." },
          { key: "overwrite", name: "Overwrite existing file", type: "boolean", required: false, default: false }
        ]
      },
      {
        id: "compress",
        name: "Compress",
        input: { type: "files", extensions: ["*"], multiple: true },
        options: []
      }
    ],
    triggers: [
      { id: "files.dragged", type: "fileDrag", actions: ["convert.image", "compress"] },
      { id: "open.shortcut", type: "keyboardShortcut", actions: ["convert.image", "compress"] }
    ],
    delivery: { type: "openRequest" }
  };

  const v2Template = {
    protocolVersion: 2,
    app: { name: "Your App Name", bundleIdentifier: "com.yourcompany.yourapp" },
    actions: [
      {
        id: "action.id",
        name: "Action Name",
        input: { type: "files", extensions: ["png", "jpg"], multiple: true },
        options: [
          { key: "quality", name: "Quality", type: "double", required: false, default: 0.9, description: "Optional description." }
        ]
      }
    ],
    triggers: [{ id: "files.dragged", type: "fileDrag", actions: ["action.id"] }],
    delivery: { type: "openRequest" }
  };

  const receiverCode = `import AppKit
import Foundation

struct HaloRequest: Decodable {
    let protocolVersion: Int
    let requestID: String
    let sourceBundleIdentifier: String
    let action: String?
    let actionID: String?
    let options: [String: JSONValue]
    var resolvedActionID: String { actionID ?? action ?? "" }
}

enum JSONValue: Decodable {
    case string(String), integer(Int), double(Double), boolean(Bool)
    case stringArray([String]), integerArray([Int]), doubleArray([Double])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let v = try? c.decode(Bool.self) { self = .boolean(v) }
        else if let v = try? c.decode(Int.self) { self = .integer(v) }
        else if let v = try? c.decode(Double.self) { self = .double(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([String].self) { self = .stringArray(v) }
        else if let v = try? c.decode([Int].self) { self = .integerArray(v) }
        else if let v = try? c.decode([Double].self) { self = .doubleArray(v) }
        else { throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported Halo option value") }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    // Launch Services may split one open request across callbacks.
    // Briefly collect URLs, then pair .halorequest with the supplied files.
    private var pendingURLs: [URL] = []
    private var work: DispatchWorkItem?

    func application(_ application: NSApplication, open urls: [URL]) {
        pendingURLs.append(contentsOf: urls)
        work?.cancel()
        let next = DispatchWorkItem { [weak self] in self?.processHaloOpen() }
        work = next
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15, execute: next)
    }

    private func processHaloOpen() {
        let urls = pendingURLs
        pendingURLs.removeAll()
        work = nil

        let requests = urls.filter { $0.pathExtension.lowercased() == "halorequest" }
        let files = urls.filter { $0.pathExtension.lowercased() != "halorequest" }
        guard let requestURL = requests.first else { return }

        do {
            let started = requestURL.startAccessingSecurityScopedResource()
            defer { if started { requestURL.stopAccessingSecurityScopedResource() } }
            let request = try JSONDecoder().decode(HaloRequest.self, from: Data(contentsOf: requestURL))

            switch request.resolvedActionID {
            case "convert.image":
                print("Halo requested convert.image", files, request.options)
            default:
                print("Unknown Halo action", request.resolvedActionID)
            }
        } catch {
            print("Halo request failed", error)
        }
    }
}`;

  const plistCode = `<key>CFBundleDocumentTypes</key>
<array>
  <dict>
    <key>CFBundleTypeName</key><string>Halo Request</string>
    <key>CFBundleTypeRole</key><string>Viewer</string>
    <key>LSItemContentTypes</key>
    <array><string>com.redstoneinvente.halorequest</string></array>
  </dict>
</array>
<key>UTExportedTypeDeclarations</key>
<array>
  <dict>
    <key>UTTypeConformsTo</key><array><string>public.json</string></array>
    <key>UTTypeDescription</key><string>Halo Integration Request</string>
    <key>UTTypeIdentifier</key><string>com.redstoneinvente.halorequest</string>
    <key>UTTypeTagSpecification</key>
    <dict>
      <key>public.filename-extension</key><array><string>halorequest</string></array>
      <key>public.mime-type</key><string>application/json</string>
    </dict>
  </dict>
</array>`;

  const manifestModels = `import Foundation

struct HaloIntegrationManifest: Decodable {
    let protocolVersion: Int
    let app: AppIdentity
    let actions: [Action]
    let triggers: [Trigger]
    let delivery: Delivery

    struct AppIdentity: Decodable { let name: String; let bundleIdentifier: String }
    struct Action: Decodable { let id: String; let name: String; let input: Input; let options: [Option] }
    struct Input: Decodable { let type: String; let extensions: [String]?; let multiple: Bool? }
    struct Option: Decodable { let key: String; let name: String; let type: String; let required: Bool; let description: String? }
    struct Trigger: Decodable { let id: String; let type: String; let actions: [String]?; let eventName: String? }
    struct Delivery: Decodable { let type: String }
}`;

  function fresh(id) {
    const old = $(id);
    if (!old) return null;
    const clone = old.cloneNode(true);
    old.replaceWith(clone);
    return clone;
  }

  ["appName", "bundleIdentifier", "addActionBtn", "resetBtn", "downloadBtn", "copyJsonBtn",
   "loadTemplateBtn", "loadTemplateTop", "downloadTemplateBtn", "copyTemplateBtn", "copySwiftBtn"]
    .forEach(fresh);

  function newID(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function ids(raw) { return [...new Set(String(raw || "").split(/[\s,]+/).map(v => v.trim()).filter(Boolean))]; }
  function validID(value) { return value.length <= 160 && ID_RE.test(value); }
  function escapeHTML(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function defaultText(value) { return value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value); }

  function parseDefault(type, raw) {
    const text = String(raw ?? "");
    const trimmed = text.trim();
    if (type === "string") return { ok: true, value: text };
    if (type === "integer") {
      if (!/^-?\d+$/.test(trimmed)) return { ok: false, message: "must be an integer" };
      const n = Number(trimmed);
      return Number.isSafeInteger(n) ? { ok: true, value: n } : { ok: false, message: "is outside the safe integer range" };
    }
    if (type === "double") {
      const n = Number(trimmed);
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, message: "must be a finite number" };
    }
    if (type === "boolean") {
      if (trimmed === "true") return { ok: true, value: true };
      if (trimmed === "false") return { ok: true, value: false };
      return { ok: false, message: "must be true or false" };
    }
    const parts = text.split(/[,\n]+/).map(v => v.trim()).filter(Boolean);
    if (type === "stringArray") return { ok: true, value: parts };
    if (type === "integerArray") {
      if (!parts.every(v => /^-?\d+$/.test(v))) return { ok: false, message: "must contain only integers" };
      const nums = parts.map(Number);
      return nums.every(Number.isSafeInteger) ? { ok: true, value: nums } : { ok: false, message: "contains an unsafe integer" };
    }
    if (type === "doubleArray") {
      const nums = parts.map(Number);
      return nums.every(Number.isFinite) ? { ok: true, value: nums } : { ok: false, message: "must contain finite numbers" };
    }
    return { ok: false, message: "uses an unsupported type" };
  }

  function v2AddOption(action, data = {}) {
    const id = newID("o");
    const card = document.createElement("div");
    card.className = "option-card";
    card.innerHTML = `
      <div class="option-card-head"><span class="option-index">Option ${action.options.length + 1}</span><button class="remove-option" type="button">Remove</button></div>
      <div class="option-grid">
        <label>Key<input id="${id}-key" type="text" placeholder="quality" spellcheck="false"></label>
        <label>Display name<input id="${id}-name" type="text" placeholder="Quality"></label>
        <label>Data type<select id="${id}-type">${optionTypes.map(([v,l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
        <label>Required<span class="check-row"><input id="${id}-required" type="checkbox"><span>Caller must provide this value</span></span></label>
        <label>Default <span class="optional">Optional</span><span class="check-row"><input id="${id}-has" type="checkbox"><span>Include a typed default</span></span><input id="${id}-default" type="text" placeholder="0.9 · false · png, jpg"></label>
        <label class="option-description">Description <span class="optional">Optional</span><input id="${id}-description" type="text" placeholder="What this option controls"></label>
      </div>`;
    action.optionsContainer.appendChild(card);
    const entry = { id, card, key: `${id}-key`, name: `${id}-name`, type: `${id}-type`, required: `${id}-required`, has: `${id}-has`, def: `${id}-default`, description: `${id}-description` };
    action.options.push(entry);
    $(entry.key).value = data.key || "";
    $(entry.name).value = data.name || "";
    $(entry.type).value = data.type || "string";
    $(entry.required).checked = Boolean(data.required);
    $(entry.has).checked = Object.prototype.hasOwnProperty.call(data, "default");
    $(entry.def).value = defaultText(data.default);
    $(entry.description).value = data.description || "";
    const sync = () => { $(entry.def).disabled = !$(entry.has).checked; v2Render(); };
    card.querySelectorAll("input,select").forEach(el => { el.addEventListener("input", v2Render); el.addEventListener("change", v2Render); });
    $(entry.has).addEventListener("change", sync);
    card.querySelector(".remove-option").addEventListener("click", () => { action.options = action.options.filter(o => o.id !== id); card.remove(); renumberOptions(); v2Render(); });
    sync();
  }

  function renumberOptions() {
    state.actions.forEach(action => action.options.forEach((option, index) => option.card.querySelector(".option-index").textContent = `Option ${index + 1}`));
  }

  function v2AddAction(data = {}) {
    const id = newID("a");
    const input = data.input || ((data.supportedExtensions || []).length ? { type: "files", extensions: data.supportedExtensions, multiple: true } : { type: "files", extensions: [], multiple: true });
    const card = document.createElement("div");
    card.className = "action-card";
    card.innerHTML = `
      <div class="action-card-head"><span class="action-index">Action ${state.actions.length + 1}</span><button class="remove-action" type="button">Remove</button></div>
      <div class="action-grid">
        <label>Action ID<input id="${id}-id" type="text" placeholder="convert.image" spellcheck="false"></label>
        <label>Display name<input id="${id}-name" type="text" placeholder="Convert Image"></label>
        <label>Input type<select id="${id}-input"><option value="files">Files</option><option value="none">No input</option></select></label>
        <label class="file-only">Supported extensions<input id="${id}-ext" type="text" placeholder="jpg, jpeg, heic, webp" spellcheck="false"><span class="hint">No dots. Use <code>*</code> for any file.</span></label>
        <label class="file-only">Multiple files<span class="check-row"><input id="${id}-multiple" type="checkbox"><span>Allow more than one file per invocation</span></span></label>
      </div>
      <div class="options-section"><div class="options-title-row"><div><h4>Request options</h4><p>Typed values Halo may collect or send with this action.</p></div><button class="ghost tiny add-option" type="button">+ Add option</button></div><div class="options-list"></div></div>`;
    $("actions").appendChild(card);
    const entry = { id, card, idField: `${id}-id`, nameField: `${id}-name`, inputField: `${id}-input`, extField: `${id}-ext`, multipleField: `${id}-multiple`, options: [], optionsContainer: card.querySelector(".options-list") };
    state.actions.push(entry);
    $(entry.idField).value = data.id || "";
    $(entry.nameField).value = data.name || "";
    $(entry.inputField).value = input.type || "files";
    $(entry.extField).value = (input.extensions || []).join(", ");
    $(entry.multipleField).checked = input.multiple !== false;
    const sync = () => { card.querySelectorAll(".file-only").forEach(el => el.hidden = $(entry.inputField).value !== "files"); v2Render(); };
    card.querySelectorAll("input,select").forEach(el => { el.addEventListener("input", v2Render); el.addEventListener("change", v2Render); });
    $(entry.inputField).addEventListener("change", sync);
    card.querySelector(".add-option").addEventListener("click", () => v2AddOption(entry));
    card.querySelector(".remove-action").addEventListener("click", () => { state.actions = state.actions.filter(a => a.id !== id); card.remove(); renumberActionsV2(); v2Render(); });
    (data.options || []).forEach(option => v2AddOption(entry, option));
    sync(); renumberActionsV2();
  }

  function renumberActionsV2() { state.actions.forEach((action, index) => action.card.querySelector(".action-index").textContent = `Action ${index + 1}`); }

  function triggerOptions(selected) {
    const labels = { fileDrag: "File drag", keyboardShortcut: "Keyboard shortcut", manual: "Manual", partnerEvent: "Partner event (reserved)" };
    return TRIGGER_TYPES.map(type => `<option value="${type}"${type === selected ? " selected" : ""}>${labels[type]}</option>`).join("");
  }

  function v2AddTrigger(data = {}) {
    const id = newID("t");
    const card = document.createElement("div");
    card.className = "trigger-card";
    card.innerHTML = `
      <div class="action-card-head"><span class="trigger-index">Trigger ${state.triggers.length + 1}</span><button class="remove-trigger" type="button">Remove</button></div>
      <div class="trigger-grid">
        <label>Trigger ID<input id="${id}-id" type="text" placeholder="files.dragged" spellcheck="false"></label>
        <label>Trigger type<select id="${id}-type">${triggerOptions(data.type || "fileDrag")}</select></label>
        <label class="trigger-actions-field">Action IDs<input id="${id}-actions" type="text" placeholder="convert.image, compress" spellcheck="false"><span class="hint">Comma or space separated. Must match action IDs above.</span></label>
        <label class="partner-only">Partner event name<input id="${id}-event" type="text" placeholder="conversion.ready" spellcheck="false"><span class="hint">Schema-valid, but external partner-event ingress is not enabled in Halo yet.</span></label>
      </div>`;
    $("triggers").appendChild(card);
    const entry = { id, card, idField: `${id}-id`, typeField: `${id}-type`, actionsField: `${id}-actions`, eventField: `${id}-event` };
    state.triggers.push(entry);
    $(entry.idField).value = data.id || "";
    $(entry.typeField).value = data.type || "fileDrag";
    $(entry.actionsField).value = (data.actions || []).join(", ");
    $(entry.eventField).value = data.eventName || data.event || "";
    const sync = () => { card.querySelector(".partner-only").hidden = $(entry.typeField).value !== "partnerEvent"; v2Render(); };
    card.querySelectorAll("input,select").forEach(el => { el.addEventListener("input", v2Render); el.addEventListener("change", v2Render); });
    $(entry.typeField).addEventListener("change", sync);
    card.querySelector(".remove-trigger").addEventListener("click", () => { state.triggers = state.triggers.filter(t => t.id !== id); card.remove(); renumberTriggers(); v2Render(); });
    sync(); renumberTriggers();
  }

  function renumberTriggers() { state.triggers.forEach((trigger, index) => trigger.card.querySelector(".trigger-index").textContent = `Trigger ${index + 1}`); }

  function readOptionV2(entry, issues) {
    const option = { key: $(entry.key).value.trim(), name: $(entry.name).value.trim(), type: $(entry.type).value, required: $(entry.required).checked };
    if ($(entry.has).checked) {
      const parsed = parseDefault(option.type, $(entry.def).value);
      if (!parsed.ok) issues.push(`Default for ${option.key || option.name || "option"} ${parsed.message}.`); else option.default = parsed.value;
    }
    const description = $(entry.description).value.trim();
    if (description) option.description = description;
    return option;
  }

  function buildV2() {
    const issues = [];
    const actions = state.actions.map(entry => {
      const inputType = $(entry.inputField).value;
      const input = inputType === "files" ? { type: "files", extensions: normalizeExtensions($(entry.extField).value), multiple: $(entry.multipleField).checked } : { type: "none" };
      return { id: $(entry.idField).value.trim(), name: $(entry.nameField).value.trim(), input, options: entry.options.map(option => readOptionV2(option, issues)) };
    });
    const triggers = state.triggers.map(entry => {
      const type = $(entry.typeField).value;
      const trigger = { id: $(entry.idField).value.trim(), type, actions: ids($(entry.actionsField).value) };
      const eventName = $(entry.eventField).value.trim();
      if (type === "partnerEvent" && eventName) trigger.eventName = eventName;
      return trigger;
    });
    return { manifest: { protocolVersion: 2, app: { name: $("appName").value.trim(), bundleIdentifier: $("bundleIdentifier").value.trim() }, actions, triggers, delivery: { type: "openRequest" } }, issues };
  }

  function validateV2(manifest, issues) {
    const errors = [...issues], warnings = [];
    if (!manifest.app.name) errors.push("App name is required.");
    if (!manifest.app.bundleIdentifier) errors.push("Bundle identifier is required.");
    if (!manifest.actions.length) errors.push("Add at least one action.");
    if (manifest.actions.length > MAX_ACTIONS) errors.push(`Halo supports at most ${MAX_ACTIONS} actions.`);
    const actionIDs = new Set(), byID = new Map();
    manifest.actions.forEach((action, index) => {
      const label = action.name || action.id || `Action ${index + 1}`;
      if (!action.id || !validID(action.id)) errors.push(`${label}: action ID is invalid.`);
      else if (actionIDs.has(action.id)) errors.push(`Action ID ${action.id} is duplicated.`); else actionIDs.add(action.id);
      if (!action.name) errors.push(`${action.id || label}: display name is required.`);
      byID.set(action.id, action);
      if (action.input.type === "files") {
        if (!action.input.extensions.length) errors.push(`${label}: file actions need at least one extension or *.`);
        action.input.extensions.forEach(ext => { if (ext.length > 32 || (ext !== "*" && !EXT_RE.test(ext))) errors.push(`${label}: invalid extension ${ext}.`); });
      }
      if (action.options.length > MAX_OPTIONS) errors.push(`${label}: maximum ${MAX_OPTIONS} options per action.`);
      const keys = new Set();
      action.options.forEach(option => {
        if (!option.key || !validID(option.key)) errors.push(`${label}: option key ${option.key || "(blank)"} is invalid.`);
        else if (keys.has(option.key)) errors.push(`${label}: option key ${option.key} is duplicated.`); else keys.add(option.key);
        if (!option.name) errors.push(`${label}: every option needs a display name.`);
        if (!OPTION_TYPES.includes(option.type)) errors.push(`${label}: unsupported option type ${option.type}.`);
      });
    });
    if (manifest.triggers.length > MAX_TRIGGERS) errors.push(`Halo supports at most ${MAX_TRIGGERS} triggers.`);
    const triggerIDs = new Set();
    manifest.triggers.forEach((trigger, index) => {
      const label = trigger.id || `Trigger ${index + 1}`;
      if (!trigger.id || !validID(trigger.id)) errors.push(`${label}: trigger ID is invalid.`);
      else if (triggerIDs.has(trigger.id)) errors.push(`Trigger ID ${trigger.id} is duplicated.`); else triggerIDs.add(trigger.id);
      if (!TRIGGER_TYPES.includes(trigger.type)) errors.push(`${label}: unsupported trigger type ${trigger.type}.`);
      if (!trigger.actions.length) errors.push(`${label}: select at least one action ID.`);
      trigger.actions.forEach(actionID => {
        const action = byID.get(actionID);
        if (!action) errors.push(`${label}: references unknown action ${actionID}.`);
        else if (trigger.type === "fileDrag" && action.input.type !== "files") errors.push(`${label}: fileDrag can only reference file-input actions.`);
      });
      if (trigger.type === "partnerEvent") {
        if (!trigger.eventName || !validID(trigger.eventName)) errors.push(`${label}: partnerEvent requires a valid eventName.`);
        warnings.push(`${label}: partnerEvent is schema-valid, but Halo's external partner-event ingress is not enabled yet.`);
      }
    });
    if (!manifest.triggers.length) warnings.push("No triggers declared. Halo still adds manual activation, but file drag and keyboard shortcut activation will not occur.");
    const bytes = new TextEncoder().encode(JSON.stringify(manifest)).length;
    if (bytes > MAX_BYTES) errors.push(`Manifest is ${bytes.toLocaleString()} bytes; Halo's maximum is ${MAX_BYTES.toLocaleString()} bytes.`);
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }

  function renderMessages(result) {
    const box = $("validationMessages");
    if (!box) return;
    const rows = [...result.errors.map(message => ({ type: "error", message })), ...result.warnings.map(message => ({ type: "warning", message }))];
    if (!rows.length) { box.innerHTML = "<div class=\"validation-row ok\"><b>✓</b><span>Manifest matches Halo's current protocol-v2 contract.</span></div>"; return; }
    box.innerHTML = rows.map(row => `<div class="validation-row ${row.type}"><b>${row.type === "error" ? "!" : "i"}</b><span>${escapeHTML(row.message)}</span></div>`).join("");
  }

  function v2Render() {
    const built = buildV2();
    $("jsonPreview").textContent = JSON.stringify(built.manifest, null, 2);
    const result = validateV2(built.manifest, built.issues);
    const pill = $("statusPill");
    if (result.errors.length) { pill.textContent = `${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`; pill.dataset.state = "error"; }
    else if (result.warnings.length) { pill.textContent = `Ready · ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`; pill.dataset.state = "warning"; }
    else { pill.textContent = "Ready"; pill.dataset.state = "ready"; }
    renderMessages(result);
  }

  function clearV2() { state.actions = []; state.triggers = []; $("actions").innerHTML = ""; $("triggers").innerHTML = ""; }
  function overlap(left, right) { const l = new Set(left || []), r = new Set(right || []); return l.has("*") || r.has("*") || [...l].some(value => r.has(value)); }

  function migrateV1(manifest) {
    const actions = (manifest.actions || []).map(action => {
      const extensions = (action.supportedExtensions || []).map(ext => String(ext).replace(/^\./, "").toLowerCase());
      return { id: action.id || "", name: action.name || "", input: extensions.length ? { type: "files", extensions, multiple: true } : { type: "none" }, options: action.options || [] };
    });
    const fileActions = actions.filter(action => action.input.type === "files");
    let triggers = (manifest.triggers || []).map((trigger, index) => {
      const ext = (trigger.supportedExtensions || []).map(value => String(value).replace(/^\./, "").toLowerCase());
      return { id: `v1.fileDrag.${index}`, type: "fileDrag", actions: fileActions.filter(action => !ext.length || overlap(ext, action.input.extensions)).map(action => action.id) };
    });
    if (!triggers.length && fileActions.length) triggers = [{ id: "files.dragged", type: "fileDrag", actions: fileActions.map(action => action.id) }];
    return { protocolVersion: 2, app: { name: manifest.name || "", bundleIdentifier: manifest.bundleIdentifier || "" }, actions, triggers, delivery: { type: "openRequest" } };
  }

  function v2Load(raw) {
    const upgraded = raw?.protocolVersion === 1;
    const manifest = upgraded ? migrateV1(raw) : raw;
    if (!manifest || manifest.protocolVersion !== 2 || !manifest.app) { showToast("Only Halo protocol v1 or v2 manifests can be imported"); return; }
    $("appName").value = manifest.app.name || "";
    $("bundleIdentifier").value = manifest.app.bundleIdentifier || "";
    clearV2();
    (manifest.actions || []).forEach(v2AddAction);
    (manifest.triggers || []).forEach(v2AddTrigger);
    if (!state.actions.length) v2AddAction();
    v2Render();
    if (upgraded) showToast("v1 imported and upgraded to v2");
  }

  function exportManifest() {
    const built = buildV2();
    const result = validateV2(built.manifest, built.issues);
    if (result.errors.length) { showToast(result.errors[0]); return null; }
    return built.manifest;
  }

  $("appName").addEventListener("input", v2Render);
  $("bundleIdentifier").addEventListener("input", v2Render);
  $("addActionBtn").addEventListener("click", () => v2AddAction());
  $("addTriggerBtn").addEventListener("click", () => v2AddTrigger());
  $("resetBtn").addEventListener("click", () => { $("appName").value = ""; $("bundleIdentifier").value = ""; clearV2(); v2AddAction(); v2AddTrigger({ id: "files.dragged", type: "fileDrag", actions: [] }); v2Render(); });
  $("downloadBtn").addEventListener("click", () => { const manifest = exportManifest(); if (manifest) download("HaloIntegration.json", JSON.stringify(manifest, null, 2) + "\n"); });
  $("copyJsonBtn").addEventListener("click", () => { const manifest = exportManifest(); if (manifest) copy(JSON.stringify(manifest, null, 2), "Manifest copied"); });
  $("loadTemplateBtn").addEventListener("click", () => v2Load(v2Example));
  $("loadTemplateTop").addEventListener("click", () => v2Load(v2Example));
  $("downloadTemplateBtn").addEventListener("click", () => download("HaloIntegration.template.json", JSON.stringify(v2Template, null, 2) + "\n"));
  $("copyTemplateBtn").addEventListener("click", () => copy(JSON.stringify(v2Template, null, 2), "Template copied"));
  $("copySwiftBtn").addEventListener("click", () => copy(manifestModels, "Swift models copied"));
  $("copyReceiverBtn").addEventListener("click", () => copy(receiverCode, "Receiver copied"));
  $("copyPlistBtn").addEventListener("click", () => copy(plistCode, "Info.plist snippet copied"));
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { v2Load(JSON.parse(await file.text())); } catch (error) { showToast(`Could not import JSON: ${error.message}`); }
    event.target.value = "";
  });

  $("templatePreview").textContent = JSON.stringify(v2Template, null, 2);
  $("swiftPreview").textContent = manifestModels;
  $("receiverPreview").textContent = receiverCode;
  $("plistPreview").textContent = plistCode;

  v2Load(v2Example);
})();

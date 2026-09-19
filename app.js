const $ = (id) => document.getElementById(id);

const state = {
  protocolVersion: 1,
  actions: []
};

const optionTypes = [
  ["string", "String"],
  ["integer", "Integer"],
  ["double", "Double"],
  ["boolean", "Boolean"],
  ["stringArray", "String[]"],
  ["integerArray", "Integer[]"],
  ["doubleArray", "Double[]"]
];

const exampleManifest = {
  protocolVersion: 1,
  name: "File Converter",
  bundleIdentifier: "com.yourcompany.fileconverter",
  actions: [
    {
      id: "convert.image",
      name: "Convert Image",
      supportedExtensions: ["jpg", "jpeg", "heic", "webp"],
      options: [
        {
          key: "format",
          name: "Output format",
          type: "string",
          required: true,
          description: "Requested output format, for example png or jpeg."
        },
        {
          key: "quality",
          name: "Quality",
          type: "double",
          required: false,
          description: "Compression quality from 0.0 to 1.0."
        },
        {
          key: "overwrite",
          name: "Overwrite existing file",
          type: "boolean",
          required: false,
          description: "Whether an existing destination file may be replaced."
        }
      ]
    },
    {
      id: "compress",
      name: "Compress",
      supportedExtensions: ["*"],
      options: []
    }
  ]
};

const blankTemplate = {
  protocolVersion: 1,
  name: "Your App Name",
  bundleIdentifier: "com.yourcompany.yourapp",
  actions: [
    {
      id: "action.id",
      name: "Action Name",
      supportedExtensions: ["png", "jpg"],
      options: [
        {
          key: "quality",
          name: "Quality",
          type: "double",
          required: false,
          description: "Optional description of what this value controls."
        }
      ]
    }
  ]
};

const swiftModels = `import Foundation

struct HaloIntegrationManifest: Codable {
    let protocolVersion: Int
    let name: String
    let bundleIdentifier: String
    let actions: [HaloIntegrationAction]
}

struct HaloIntegrationAction: Codable {
    let id: String
    let name: String
    let supportedExtensions: [String]
    let options: [HaloIntegrationOption]
}

struct HaloIntegrationOption: Codable {
    let key: String
    let name: String
    let type: HaloIntegrationOptionType
    let required: Bool
    let description: String?
}

enum HaloIntegrationOptionType: String, Codable {
    case string
    case integer
    case double
    case boolean
    case stringArray
    case integerArray
    case doubleArray
}

// Optional self-check inside your app:
func loadHaloIntegrationManifest() throws -> HaloIntegrationManifest {
    guard let url = Bundle.main.url(
        forResource: "HaloIntegration",
        withExtension: "json"
    ) else {
        throw CocoaError(.fileNoSuchFile)
    }

    let data = try Data(contentsOf: url)
    return try JSONDecoder().decode(
        HaloIntegrationManifest.self,
        from: data
    )
}`;

function normalizeExtensions(value) {
  const parts = value
    .split(/[\s,]+/)
    .map(v => v.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);
  return [...new Set(parts)];
}

function currentManifest() {
  return {
    protocolVersion: 1,
    name: $("appName").value.trim(),
    bundleIdentifier: $("bundleIdentifier").value.trim(),
    actions: state.actions.map(action => ({
      id: $(action.idField).value.trim(),
      name: $(action.nameField).value.trim(),
      supportedExtensions: normalizeExtensions($(action.extField).value),
      options: action.options.map(option => ({
        key: $(option.keyField).value.trim(),
        name: $(option.nameField).value.trim(),
        type: $(option.typeField).value,
        required: $(option.requiredField).checked,
        description: $(option.descriptionField).value.trim() || undefined
      })).map(option => {
        if (option.description === undefined) delete option.description;
        return option;
      })
    }))
  };
}

function validate(manifest) {
  if (!manifest.name || !manifest.bundleIdentifier) return "Missing app details";
  if (!manifest.actions.length) return "Add an action";
  if (manifest.actions.some(a => !a.id || !a.name || !a.supportedExtensions.length)) return "Complete all actions";

  const actionIds = manifest.actions.map(a => a.id);
  if (new Set(actionIds).size !== actionIds.length) return "Action IDs must be unique";

  for (const action of manifest.actions) {
    if (action.options.some(o => !o.key || !o.name || !o.type)) return "Complete all options";
    const keys = action.options.map(o => o.key);
    if (new Set(keys).size !== keys.length) return `Duplicate option key in ${action.name || action.id}`;
  }

  return "Ready";
}

function renderPreview() {
  const manifest = currentManifest();
  $("jsonPreview").textContent = JSON.stringify(manifest, null, 2);
  const status = validate(manifest);
  $("statusPill").textContent = status;
  $("statusPill").style.color = status === "Ready" ? "#a9ffca" : "#ffd79a";
}

function optionTypeMarkup(selected = "string") {
  return optionTypes
    .map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`)
    .join("");
}

function addOption(action, data = { key: "", name: "", type: "string", required: false, description: "" }) {
  const uid = `o${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const card = document.createElement("div");
  card.className = "option-card";
  card.dataset.uid = uid;
  card.innerHTML = `
    <div class="option-card-head">
      <span class="option-index">Option ${action.options.length + 1}</span>
      <button class="remove-option" type="button" aria-label="Remove option">Remove</button>
    </div>
    <div class="option-grid">
      <label>
        Key
        <input id="${uid}-key" type="text" placeholder="quality" spellcheck="false" />
      </label>
      <label>
        Display name
        <input id="${uid}-name" type="text" placeholder="Quality" />
      </label>
      <label>
        Data type
        <select id="${uid}-type">${optionTypeMarkup(data.type || "string")}</select>
      </label>
      <label class="required-label">
        Required
        <span class="check-row">
          <input id="${uid}-required" type="checkbox" />
          <span>Caller must provide this value</span>
        </span>
      </label>
      <label class="option-description">
        Description <span class="optional">Optional</span>
        <input id="${uid}-description" type="text" placeholder="Compression quality from 0.0 to 1.0" />
      </label>
    </div>
  `;

  action.optionsContainer.appendChild(card);

  const entry = {
    uid,
    card,
    keyField: `${uid}-key`,
    nameField: `${uid}-name`,
    typeField: `${uid}-type`,
    requiredField: `${uid}-required`,
    descriptionField: `${uid}-description`
  };
  action.options.push(entry);

  $(entry.keyField).value = data.key || "";
  $(entry.nameField).value = data.name || "";
  $(entry.typeField).value = data.type || "string";
  $(entry.requiredField).checked = Boolean(data.required);
  $(entry.descriptionField).value = data.description || "";

  card.querySelectorAll("input, select").forEach(input => {
    input.addEventListener("input", renderPreview);
    input.addEventListener("change", renderPreview);
  });

  card.querySelector(".remove-option").addEventListener("click", () => {
    action.options = action.options.filter(o => o.uid !== uid);
    card.remove();
    renumberOptions(action);
    renderPreview();
  });

  renumberOptions(action);
  renderPreview();
}

function renumberOptions(action) {
  action.options.forEach((option, i) => {
    const index = option.card.querySelector(".option-index");
    if (index) index.textContent = `Option ${i + 1}`;
  });
}

function addAction(data = { id: "", name: "", supportedExtensions: [], options: [] }) {
  const uid = `a${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const card = document.createElement("div");
  card.className = "action-card";
  card.dataset.uid = uid;
  card.innerHTML = `
    <div class="action-card-head">
      <span class="action-index">Action ${state.actions.length + 1}</span>
      <button class="remove-action" type="button" aria-label="Remove action">Remove</button>
    </div>
    <div class="action-grid">
      <label>
        Action ID
        <input id="${uid}-id" type="text" placeholder="convert.image" spellcheck="false" />
      </label>
      <label>
        Display name
        <input id="${uid}-name" type="text" placeholder="Convert Image" />
      </label>
      <label>
        Supported extensions
        <input id="${uid}-ext" type="text" placeholder="jpg, jpeg, heic, webp" spellcheck="false" />
        <span class="hint">Comma or space separated. Do not include dots. Use <code>*</code> for any file.</span>
      </label>
    </div>
    <div class="options-section">
      <div class="options-title-row">
        <div>
          <h4>Request options</h4>
          <p>Describe any extra values Halo can send when invoking this action.</p>
        </div>
        <button class="ghost tiny add-option" type="button">+ Add option</button>
      </div>
      <div class="options-list"></div>
    </div>
  `;

  $("actions").appendChild(card);
  const entry = {
    uid,
    card,
    idField: `${uid}-id`,
    nameField: `${uid}-name`,
    extField: `${uid}-ext`,
    options: [],
    optionsContainer: card.querySelector(".options-list")
  };
  state.actions.push(entry);

  $(entry.idField).value = data.id || "";
  $(entry.nameField).value = data.name || "";
  $(entry.extField).value = (data.supportedExtensions || []).join(", ");

  card.querySelectorAll(".action-grid input").forEach(input => input.addEventListener("input", renderPreview));
  card.querySelector(".add-option").addEventListener("click", () => addOption(entry));
  card.querySelector(".remove-action").addEventListener("click", () => {
    state.actions = state.actions.filter(a => a.uid !== uid);
    card.remove();
    renumberActions();
    renderPreview();
  });

  (data.options || []).forEach(option => addOption(entry, option));
  renderPreview();
}

function renumberActions() {
  state.actions.forEach((action, i) => {
    const index = action.card.querySelector(".action-index");
    if (index) index.textContent = `Action ${i + 1}`;
  });
}

function clearActions() {
  state.actions = [];
  $("actions").innerHTML = "";
}

function loadManifest(manifest) {
  $("appName").value = manifest.name || "";
  $("bundleIdentifier").value = manifest.bundleIdentifier || "";
  clearActions();
  (manifest.actions || []).forEach(addAction);
  if (!(manifest.actions || []).length) addAction();
  renderPreview();
  document.querySelector("#builder").scrollIntoView({ behavior: "smooth", block: "start" });
}

function reset() {
  $("appName").value = "";
  $("bundleIdentifier").value = "";
  clearActions();
  addAction();
  renderPreview();
}

function download(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copy(text, message = "Copied") {
  await navigator.clipboard.writeText(text);
  showToast(message);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1300);
}

$("appName").addEventListener("input", renderPreview);
$("bundleIdentifier").addEventListener("input", renderPreview);
$("addActionBtn").addEventListener("click", () => addAction());
$("resetBtn").addEventListener("click", reset);

$("downloadBtn").addEventListener("click", () => {
  const manifest = currentManifest();
  const status = validate(manifest);
  if (status !== "Ready") {
    showToast(status);
    return;
  }
  download("HaloIntegration.json", JSON.stringify(manifest, null, 2) + "\n");
});

$("copyJsonBtn").addEventListener("click", () => copy(JSON.stringify(currentManifest(), null, 2), "Manifest copied"));
$("loadTemplateBtn").addEventListener("click", () => loadManifest(exampleManifest));
$("loadTemplateTop").addEventListener("click", () => loadManifest(exampleManifest));
$("downloadTemplateBtn").addEventListener("click", () => download("HaloIntegration.template.json", JSON.stringify(blankTemplate, null, 2) + "\n"));
$("copyTemplateBtn").addEventListener("click", () => copy(JSON.stringify(blankTemplate, null, 2), "Template copied"));
$("copySwiftBtn").addEventListener("click", () => copy(swiftModels, "Swift models copied"));

$("templatePreview").textContent = JSON.stringify(blankTemplate, null, 2);
$("swiftPreview").textContent = swiftModels;

loadManifest(exampleManifest);
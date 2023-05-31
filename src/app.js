import WebGL from "three/examples/jsm/capabilities/WebGL.js";
import { Viewer } from "./viewer.js";
import { SimpleDropzone } from "simple-dropzone";
import { Validator } from "./validator.js";
import { Footer } from "./components/footer";
import queryString from "query-string";

window.VIEWER = {};

if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
    console.error("The File APIs are not fully supported in this browser.");
} else if (!WebGL.isWebGLAvailable()) {
    console.error("WebGL is not supported in this browser.");
}

class App {
    /**
     * @param  {Element} el
     * @param  {Location} location
     */
    constructor(el, location) {
        const hash = location.hash ? queryString.parse(location.hash) : {};
        this.options = {
            kiosk: Boolean(hash.kiosk),
            model: hash.model || "",
            preset: hash.preset || "",
            cameraPosition: hash.cameraPosition
                ? hash.cameraPosition.split(",").map(Number)
                : null,
        };

        this.el = el;
        this.viewer = null;
        this.viewerEl = null;
        this.spinnerEl = el.querySelector(".spinner");
        this.dropEl = el.querySelector(".dropzone");
        this.inputEl = el.querySelector("#file-input");
        this.validator = new Validator(el);

        this.createDropzone();
        [
            "http://127.0.0.1:8887/tilesetGBLF2.glb",
            "http://127.0.0.1:8887/tilesetGBLF1.glb",
        ].forEach((x) => {
            setTimeout(() => this.view(x, "/", {}), 2000);
        });

        // this.view(
        //   "https://tile.googleapis.com/v1/3dtiles/datasets/CgA/files/UlRPVEYubm9kZWRhdGEucGxhbmV0b2lkPWVhcnRoLG5vZGVfZGF0YV9lcG9jaD05MzMscGF0aD0zMTUyNjA0MzQxNDE0MTcxNjM2LGNhY2hlX3ZlcnNpb249Ng.glb?key=AIzaSyA5Hq-1EVAiRbuNdL8QGTG1SxuASC5iZco&session=CNO2-IOpq7LmXw",
        //   "/",
        //   {}
        // );
        this.hideSpinner();

        const options = this.options;

        if (options.kiosk) {
            const headerEl = document.querySelector("header");
            headerEl.style.display = "none";
        }

        if (options.model) {
            this.view(options.model, "", new Map());
        }
    }

    /**
     * Sets up the drag-and-drop controller.
     */
    createDropzone() {
        const dropCtrl = new SimpleDropzone(this.dropEl, this.inputEl);
        dropCtrl.on("drop", ({ files }) => this.load(files));
        dropCtrl.on("dropstart", () => this.showSpinner());
        dropCtrl.on("droperror", () => this.hideSpinner());
    }

    /**
     * Sets up the view manager.
     * @return {Viewer}
     */
    createViewer() {
        this.viewerEl = document.createElement("div");
        this.viewerEl.classList.add("viewer");
        this.dropEl.innerHTML = "";
        this.dropEl.appendChild(this.viewerEl);
        this.viewer = new Viewer(this.viewerEl, this.options);
        return this.viewer;
    }

    /**
     * Loads a fileset provided by user action.
     * @param  {Map<string, File>} fileMap
     */
    load(fileMap) {
        let rootFile;
        let rootPath;
        Array.from(fileMap).forEach(([path, file]) => {
            if (file.name.match(/\.(gltf|glb)$/)) {
                rootFile = file;
                rootPath = path.replace(file.name, "");
            }
        });

        if (!rootFile) {
            this.onError("No .gltf or .glb asset found.");
        }
        this.view(rootFile, rootPath, fileMap);
    }

    /**
     * Passes a model to the viewer, given file and resources.
     * @param  {File|string} rootFile
     * @param  {string} rootPath
     * @param  {Map<string, File>} fileMap
     */
    view(rootFile, rootPath, fileMap) {
        if (this.viewer) this.viewer.clear();

        const viewer = this.viewer || this.createViewer();

        const fileURL =
            typeof rootFile === "string"
                ? rootFile
                : URL.createObjectURL(rootFile);

        const cleanup = () => {
            this.hideSpinner();
            if (typeof rootFile === "object") URL.revokeObjectURL(fileURL);
        };

        viewer
            .load(rootFile, rootPath, fileMap)
            .catch((e) => this.onError(e))
            .then((gltf) => {
                if (!this.options.kiosk) {
                    this.validator.validate(fileURL, rootPath, fileMap, gltf);
                }
                cleanup();
            });
    }

    /**
     * @param  {Error} error
     */
    onError(error) {
        let message = (error || {}).message || error.toString();
        if (message.match(/ProgressEvent/)) {
            message =
                "Unable to retrieve this file. Check JS console and browser network tab.";
        } else if (message.match(/Unexpected token/)) {
            message = `Unable to parse file content. Verify that this file is valid. Error: "${message}"`;
        } else if (error && error.target && error.target instanceof Image) {
            message = "Missing texture: " + error.target.src.split("/").pop();
        }
        window.alert(message);
        console.error(error);
    }

    showSpinner() {
        this.spinnerEl.style.display = "";
    }

    hideSpinner() {
        this.spinnerEl.style.display = "none";
    }
}

document.body.innerHTML += Footer();

document.addEventListener("DOMContentLoaded", () => {
    const app = new App(document.body, location);

    window.VIEWER.app = app;

    console.info("[glTF Viewer] Debugging data exported as `window.VIEWER`.");
});

function isIFrame() {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

// bandwidth on this page is very high. hoping to
// figure out what percentage of that is embeds.
Tinybird.trackEvent("load", { embed: isIFrame() });

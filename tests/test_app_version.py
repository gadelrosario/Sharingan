import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class AppVersionTests(unittest.TestCase):
    def test_canonical_metadata_contract(self):
        command = """
const {APP_VERSION}=require('./js/app-version.js');
if(!Object.isFrozen(APP_VERSION))process.exit(1);
console.log(JSON.stringify(APP_VERSION));
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout), {"phase": "Jōnin", "milestone": "3.7", "label": "Jōnin 3.7"})

    def test_canonical_metadata_renders_all_registered_surfaces(self):
        command = """
const {APP_VERSION,applyVersionMetadata}=require('./js/app-version.js');
const nodes=[{textContent:''},{textContent:''},{textContent:''},{textContent:''}];
const documentRef={title:'',documentElement:{dataset:{}},querySelectorAll:()=>nodes};
applyVersionMetadata(documentRef);
if(documentRef.title!==`Gerard Fantasy HQ — ${APP_VERSION.label}`)process.exit(1);
if(documentRef.documentElement.dataset.appVersion!==APP_VERSION.label)process.exit(1);
if(nodes.some(node=>node.textContent!==APP_VERSION.label))process.exit(1);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_one_browser_source_owns_visible_version_literal(self):
        version = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        manifest = (ROOT / "manifest.webmanifest").read_text(encoding="utf-8")
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        self.assertEqual(version.count("label:'Jōnin 3.7'"), 1)
        for source in (html, app, manifest, worker):
            self.assertNotIn("Jōnin 3.7", source)
        self.assertIn("const APP_VERSION=window.FantasyHQAppVersion", app)

    def test_main_menu_and_each_mode_use_canonical_label(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertEqual(html.count("data-app-version"), 4)
        for mode_id in ("practiceChoice", "yahooChoice", "liveChoice"):
            segment = html.split(f'id="{mode_id}"', 1)[1].split("</div>", 1)[0]
            self.assertIn("data-app-version", segment)
        self.assertIn("${APP_VERSION.label} • Draft Slot", app)

    def test_no_active_user_facing_jonin_33_remains(self):
        for path in (ROOT / "index.html", ROOT / "js" / "app.js", ROOT / "manifest.webmanifest"):
            self.assertNotIn("Jōnin 3.3", path.read_text(encoding="utf-8"), str(path))

    def test_version_application_is_text_safe_and_responsive_shared(self):
        source = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("node.textContent=APP_VERSION.label", source)
        self.assertIn("documentRef.title=", source)
        self.assertIn('class="version" data-app-version', html)
        self.assertEqual(html.count('id="headerDraftContext"'), 1)

    def test_offline_cache_contains_canonical_metadata(self):
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn('./js/app-version.js?v=1.0.0', worker)
        self.assertIn('fantasy-hq-jonin-3-7-2', worker)
        self.assertIn('service-worker.js?v=jonin_3_7_2', app)

    def test_architecture_remains_browser_isolated(self):
        sources = "\n".join((ROOT / path).read_text(encoding="utf-8") for path in ("index.html", "js/app.js", "service-worker.js"))
        self.assertNotIn("intelligence-core", sources)
        self.assertNotIn("decision-engine", sources)


if __name__ == "__main__":
    unittest.main()

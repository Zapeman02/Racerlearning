import json
import subprocess
import time
import unittest
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 5198
BASE = f"http://localhost:{PORT}/"
SHOTS = ROOT / "e2e" / "screenshots"


class UiBase:
    browser_name = None

    @classmethod
    def setUpClass(cls):
        cls.server = subprocess.Popen(["npx", "vite", "--port", str(PORT), "--strictPort"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urlopen(BASE)
                break
            except OSError:
                time.sleep(0.1)
        cls.pw = sync_playwright().start()
        cls.browser = getattr(cls.pw, cls.browser_name).launch()
        SHOTS.mkdir(exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.terminate()
        cls.server.wait()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.on("console", lambda m: m.type == "error" and self.errors.append(m.text))
        self.page.goto(BASE)
        self.page.wait_for_selector('[data-model="base"]')

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.context.close()

    def shot(self, name):
        self.page.screenshot(path=str(SHOTS / f"{self.browser_name}-{name}.png"))

    def create_model(self, name):
        self.page.click('[data-testid="new-model"]')
        self.page.fill('[data-testid="new-name"]', name)
        self.page.click('[data-testid="create-model"]')
        self.page.wait_for_selector('[data-testid="play"]')

    def train_one_generation(self):
        self.page.click('[data-testid="play"]')
        self.page.click('[data-testid="speed"] button:has-text("MAX")')
        self.page.wait_for_function("Number(document.querySelector('[data-testid=stat-generation]').textContent) >= 1", timeout=30000)

    def stored(self, key):
        return json.loads(self.page.evaluate(f"localStorage.getItem('{key}') || '[]'"))

    def test_garage_shows_base_model(self):
        card = self.page.locator('[data-model="base"]')
        self.assertIn("KAMI-01", card.locator("input").input_value())
        self.assertIn("BASE", card.inner_text())
        self.assertTrue(card.locator("input").is_disabled())
        self.page.wait_for_timeout(500)
        self.shot("garage")

    def test_create_model_and_train(self):
        self.create_model("Drifty")
        self.assertEqual(self.page.locator('[data-testid="train-meta"]').inner_text(), "Untrained")
        self.train_one_generation()
        self.assertIn("Gen", self.page.locator('[data-testid="train-meta"]').inner_text())
        self.shot("train")
        model = next(m for m in self.stored("racerlearning.models") if m["name"] == "Drifty")
        self.assertGreaterEqual(model["generation"], 1)
        self.assertEqual(len(model["weights"]), 226)
        self.page.reload()
        self.page.wait_for_selector('[data-model="base"]')
        self.assertIn("Gen", self.page.locator(f'[data-model="{model["id"]}"] .meta').inner_text())

    def test_reward_slider_persists(self):
        self.create_model("Slider")
        slider = self.page.locator('[data-reward="drift"]')
        slider.fill("4.5")
        slider.dispatch_event("change")
        self.assertEqual(self.page.locator('label:has([data-reward="drift"]) output').inner_text(), "+4.5")
        self.page.reload()
        self.page.click('[data-screen="train"]')
        self.assertEqual(self.page.locator('[data-reward="drift"]').input_value(), "4.5")

    def test_rename_and_delete_model(self):
        self.create_model("Old")
        self.page.click('[data-screen="garage"]')
        model_id = self.stored("racerlearning.models")[0]["id"]
        name = self.page.locator(f'[data-model="{model_id}"] input')
        name.fill("Tokyo Ghost")
        name.dispatch_event("change")
        self.assertEqual(self.stored("racerlearning.models")[0]["name"], "Tokyo Ghost")
        self.page.once("dialog", lambda d: d.accept())
        self.page.click(f'[data-model="{model_id}"] button:has-text("Delete")')
        self.assertEqual(self.stored("racerlearning.models"), [])
        self.assertEqual(self.page.locator(f'[data-model="{model_id}"]').count(), 0)

    def test_export_and_import_model(self):
        with self.page.expect_download() as info:
            self.page.click('[data-model="base"] button:has-text("Export")')
        path = info.value.path()
        self.assertEqual(json.loads(Path(path).read_text())["format"], "racerlearning-model")
        with self.page.expect_file_chooser() as chooser:
            self.page.click('button:has-text("Import")')
        chooser.value.set_files(path)
        self.page.wait_for_selector('.toast.visible')
        self.assertIn("Imported KAMI-01", self.page.locator(".toast").inner_text())
        self.assertEqual(len(self.stored("racerlearning.models")), 1)

    def test_import_rejects_bad_file(self):
        bad = SHOTS / "bad.json"
        bad.write_text('{"hello": 1}')
        with self.page.expect_file_chooser() as chooser:
            self.page.click('button:has-text("Import")')
        chooser.value.set_files(str(bad))
        self.page.wait_for_selector('.toast.visible')
        self.assertIn("Not a Racerlearning model", self.page.locator(".toast").inner_text())

    def test_generate_and_save_track(self):
        self.page.click('[data-screen="tracks"]')
        self.page.click('[data-testid="theme"] button:has-text("Hakone Touge")')
        self.page.click('[data-testid="generate"]')
        self.page.fill('[data-testid="track-name"]', "Mountain Run")
        self.page.click('[data-testid="save-track"]')
        self.assertIn("Mountain Run", self.page.locator('[data-testid="track-list"]').inner_text())
        self.assertEqual(self.stored("racerlearning.tracks")[0]["themeId"], "touge")
        self.page.wait_for_timeout(500)
        self.shot("tracks")
        self.page.reload()
        self.page.click('[data-screen="race"]')
        self.assertIn("Mountain Run", self.page.locator('[data-testid="race-tracks"]').inner_text())

    def test_race_runs_to_results(self):
        self.page.click('[data-screen="race"]')
        self.page.click('[data-testid="laps"] button:has-text("1")')
        self.page.click('[data-testid="start-race"]')
        self.page.wait_for_selector(".countdown.visible")
        self.assertEqual(self.page.locator('[data-testid="hud-lap"]').inner_text(), "1/1")
        self.page.wait_for_timeout(4500)
        self.shot("race")
        self.page.click('[data-testid="camera-toggle"]')
        self.page.wait_for_selector('[data-testid="results"]', timeout=40000)
        self.assertIn("KAMI-01 wins", self.page.locator('[data-testid="results"]').inner_text())
        self.page.click('button:has-text("New race")')
        self.page.wait_for_selector('[data-testid="start-race"]')

    def test_race_needs_a_racer(self):
        self.page.click('[data-screen="race"]')
        self.page.click('[data-racer="base"]')
        self.assertTrue(self.page.locator('[data-testid="start-race"]').is_disabled())

    def test_mobile_layout(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.wait_for_timeout(300)
        nav = self.page.locator("nav.tabs").bounding_box()
        panel = self.page.locator(".panel").bounding_box()
        self.assertAlmostEqual(nav["y"] + nav["height"], 844, delta=1)
        self.assertLessEqual(panel["y"] + panel["height"], nav["y"] + 1)
        self.assertEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)
        self.shot("mobile-garage")
        self.create_model("Pocket")
        self.train_one_generation()
        self.shot("mobile-train")


class TestChromium(UiBase, unittest.TestCase):
    browser_name = "chromium"


class TestWebkit(UiBase, unittest.TestCase):
    browser_name = "webkit"


if __name__ == "__main__":
    unittest.main()

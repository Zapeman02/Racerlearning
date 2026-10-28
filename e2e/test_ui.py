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
        self.page.click(f'[data-model="{model_id}"] button:has-text("Paint")')
        self.page.click(f'[data-model="{model_id}"] [aria-label="Colour #7cff4f"]')
        self.page.click(f'[data-model="{model_id}"] [aria-label="Accent #14141a"]')
        self.page.click(f'[data-model="{model_id}"] [data-testid="livery"] button:has-text("Two-tone")')
        stored = self.stored("racerlearning.models")[0]
        self.assertEqual([stored["color"], stored["accent"], stored["livery"]], ["#7cff4f", "#14141a", "two-tone"])
        self.page.click(f'[data-model="{model_id}"] button:has-text("Done")')
        self.assertEqual(self.page.locator(f'[data-model="{model_id}"] .paint-panel').count(), 0)
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

    def test_advanced_track_saves_shape(self):
        self.page.click('nav [data-screen="tracks"]')
        self.assertFalse(self.page.locator('[data-shape="corners"]').is_visible())
        self.page.check('[data-testid="advanced"]')
        self.page.fill('[data-shape="corners"]', "16")
        self.page.fill('[data-shape="sharpness"]', "0.8")
        self.page.click('[data-feature="hairpin"]')
        self.page.click('[data-testid="generate"]')
        self.page.fill('[data-testid="track-name"]', "Twisty")
        self.page.click('[data-testid="save-track"]')
        self.assertEqual(self.stored("racerlearning.tracks")[0]["shape"], {"corners": 16, "sharpness": 0.8, "features": ["hairpin"]})

    def test_export_and_import_track(self):
        self.page.click('nav [data-screen="tracks"]')
        with self.page.expect_download() as info:
            self.page.click('[aria-label="Export Training Circuit"]')
        path = info.value.path()
        self.assertEqual(json.loads(Path(path).read_text())["format"], "racerlearning-track")
        with self.page.expect_file_chooser() as chooser:
            self.page.click('[data-testid="import-track"]')
        chooser.value.set_files(path)
        self.page.wait_for_selector('.toast.visible')
        self.assertIn("Imported Training Circuit", self.page.locator(".toast").inner_text())
        self.assertEqual(len(self.stored("racerlearning.tracks")), 1)
        self.assertEqual(self.page.locator('[data-testid="track-list"] .list-item').count(), 2)

    def test_track_import_rejects_model_file(self):
        self.page.click('nav [data-screen="tracks"]')
        bad = SHOTS / "model-as-track.json"
        bad.write_text(json.dumps({"format": "racerlearning-model", "model": {}}))
        with self.page.expect_file_chooser() as chooser:
            self.page.click('[data-testid="import-track"]')
        chooser.value.set_files(str(bad))
        self.page.wait_for_selector('.toast.visible')
        self.assertIn("Not a Racerlearning track", self.page.locator(".toast").inner_text())

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

    def test_how_it_works(self):
        self.page.click('.how-btn')
        how = self.page.locator('[data-testid="how"]')
        self.assertIn("how it works", how.inner_text().lower())
        self.assertEqual(how.locator(".how-step").count(), 5)
        self.assertEqual(self.page.locator('[data-testid="diagram"] circle').count(), 16)
        self.assertIn("active", self.page.locator(".how-btn").get_attribute("class"))
        self.page.wait_for_timeout(400)
        self.shot("how")
        self.page.click('[data-testid="how-train"]')
        self.assertIn("active", self.page.locator('nav [data-screen="train"]').get_attribute("class"))

    def test_mobile_how_it_works(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.click('.how-btn')
        self.assertFalse(self.page.locator(".how-label").is_visible())
        self.assertEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)
        self.page.wait_for_timeout(400)
        self.shot("mobile-how")

    def assert_nav_usable(self):
        for screen in ["garage", "train", "tracks", "race"]:
            button = self.page.locator(f'nav [data-screen="{screen}"]')
            box = button.bounding_box()
            self.assertIsNotNone(box, f"{screen} tab hidden")
            hit = self.page.evaluate(
                "([x, y]) => document.elementFromPoint(x, y)?.closest('[data-screen]')?.dataset.screen ?? null",
                [box["x"] + box["width"] / 2, box["y"] + box["height"] / 2],
            )
            self.assertEqual(hit, screen, f"{screen} tab is covered")

    def test_mobile_nav_works_from_every_screen(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.create_model("Nav")
        for start in ["garage", "train", "tracks", "race", "how"]:
            for target in ["garage", "train", "tracks", "race"]:
                self.page.click(f'#ui [data-screen="{start}"]')
                self.assert_nav_usable()
                self.page.click(f'nav [data-screen="{target}"]')
                self.assertIn("active", self.page.locator(f'nav [data-screen="{target}"]').get_attribute("class"))

    def test_mobile_nav_works_during_and_after_race(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.click('nav [data-screen="race"]')
        self.page.click('[data-testid="laps"] button:has-text("1")')
        self.page.click('[data-testid="start-race"]')
        self.page.wait_for_selector(".countdown.visible")
        self.assert_nav_usable()
        self.page.click('nav [data-screen="tracks"]')
        self.page.wait_for_selector('[data-testid="track-list"]')
        self.page.click('nav [data-screen="race"]')
        self.page.wait_for_selector('[data-testid="results"]', timeout=40000)
        self.assert_nav_usable()
        self.page.click('nav [data-screen="garage"]')
        self.page.wait_for_selector('[data-model="base"]')

    def test_screenshot_tour(self):
        for size, prefix in [({"width": 1440, "height": 900}, "tour-desktop"), ({"width": 390, "height": 844}, "tour-mobile")]:
            self.page.set_viewport_size(size)
            self.page.evaluate("localStorage.clear()")
            self.page.reload()
            self.page.wait_for_selector('[data-model="base"]')
            self.page.wait_for_timeout(400)
            self.shot(f"{prefix}-01-garage")
            self.page.click('[data-testid="new-model"]')
            self.page.fill('[data-testid="new-name"]', "Tour")
            self.shot(f"{prefix}-02-create")
            self.page.click('[data-testid="create-model"]')
            self.page.wait_for_selector('[data-testid="play"]')
            self.shot(f"{prefix}-03-train-paused")
            self.train_one_generation()
            self.page.click('[data-testid="speed"] button:has-text("1×")')
            self.page.wait_for_timeout(600)
            self.shot(f"{prefix}-04-train-running")
            self.page.click('nav [data-screen="tracks"]')
            self.page.click('[data-testid="theme"] button:has-text("Akiba Grid")')
            self.page.click('[data-testid="generate"]')
            self.page.wait_for_timeout(500)
            self.shot(f"{prefix}-05-tracks-generated")
            self.page.click('nav [data-screen="race"]')
            self.page.wait_for_timeout(300)
            self.shot(f"{prefix}-06-race-setup")
            self.page.click('[data-testid="laps"] button:has-text("1")')
            self.page.click('[data-testid="start-race"]')
            self.page.wait_for_selector(".countdown.visible")
            self.page.wait_for_timeout(300)
            self.shot(f"{prefix}-07-race-countdown")
            self.page.wait_for_timeout(4500)
            self.shot(f"{prefix}-08-race-follow")
            self.page.click('[data-testid="camera-toggle"]')
            self.page.wait_for_timeout(300)
            self.shot(f"{prefix}-09-race-overview")
            self.page.wait_for_selector('[data-testid="results"]', timeout=60000)
            self.shot(f"{prefix}-10-results")
            self.page.click('#ui [data-screen="how"]')
            self.page.wait_for_timeout(400)
            self.shot(f"{prefix}-11-how")

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

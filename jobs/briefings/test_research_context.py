"""Local, deterministic regression tests; no network or live cron writes."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

SCRIPT = Path(__file__).with_name("research_context.py")
JOB = "9892cfac63a7"
NOW = datetime(2026, 9, 6, 12, tzinfo=ZoneInfo("Europe/Berlin"))


class ResearchContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.logs = self.home / "cron" / "output" / JOB
        self.logs.mkdir(parents=True)

    def log(self, response="Aktueller Bericht", name="2026-09-06_03-03-42.md", prompt="Auftrag", header="2026-09-06 03:03:42"):
        path = self.logs / name
        path.write_text(f"# Cron Job: recherche\n\n**Run Time:** {header}\n\n## Prompt\n\n{prompt}\n\n## Response\n\n{response}\n", encoding="utf-8")
        return path

    def collect(self):
        self.assertTrue(SCRIPT.exists(), "Vorlauf-Helfer fehlt")
        spec = importlib.util.spec_from_file_location("research_context", SCRIPT)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        result = module.collect(self.home, now=NOW)
        for key in ("source_job_id", "path", "run_at", "status", "response"):
            self.assertIn(key, result)
        self.assertEqual(result["source_job_id"], JOB)
        self.assertTrue(result["response"].strip())
        self.assertNotIn(result["response"].strip(), ("[SILENT]", "SILENT", "NO_REPLY"))
        return result

    def test_long_prompt_extracts_last_response_before_limit(self):
        response = "Neue Fakten\n\n## Quellen\nhttps://example.org/beleg"
        path = self.log(response, prompt="## Response\nAlter eingebetteter Bericht\n" + "P" * 27000)
        result = self.collect()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["response"], response)
        self.assertEqual(result["path"], str(path))
        self.assertEqual(result["run_at"], "2026-09-06T03:03:42+02:00")

    def test_missing_log_is_explicit(self):
        result = self.collect()
        self.assertEqual(result["status"], "missing")
        self.assertIsNone(result["path"])
        self.assertIsNone(result["run_at"])

    def test_latest_filename_wins_not_mtime(self):
        older = self.log("ALT", name="2026-09-05_23-59-59.md")
        newest = self.log("NEU")
        os.utime(older, (2000000000, 2000000000))
        os.utime(newest, (1, 1))
        (self.logs / "README.md").write_text("Kein Run")
        result = self.collect()
        self.assertEqual(result["path"], str(newest))
        self.assertEqual(result["response"], "NEU")

    def test_empty_latest_never_falls_back(self):
        self.log("Guter alter Bericht", name="2026-09-05_23-59-59.md")
        latest = self.log("   ")
        result = self.collect()
        self.assertEqual(result["status"], "empty")
        self.assertEqual(result["path"], str(latest))
        self.assertNotIn("Guter alter Bericht", result["response"])
        latest.write_text("")
        self.assertEqual(self.collect()["status"], "empty")

    def test_silence_markers_are_explicit_json_status(self):
        for marker in ("[SILENT]", "SILENT", "NO_REPLY"):
            with self.subTest(marker=marker):
                self.log("  " + marker + "  ")
                self.assertEqual(self.collect()["status"], "silent")

    def test_missing_response_block(self):
        path = self.log()
        path.write_text("# Cron Job: recherche\n\n## Prompt\nNur Auftrag")
        self.assertEqual(self.collect()["status"], "missing_response")

    def test_fenced_response_heading_is_not_a_real_block(self):
        response = "Bericht\n\n```markdown\n## Response\nNur Codebeispiel\n```\n\nQuellenende"
        self.log(response)
        self.assertEqual(self.collect()["response"], response)
        path = self.log()
        path.write_text("## Prompt\n~~~markdown\n## Response\nAlter Bericht\n~~~\n")
        self.assertEqual(self.collect()["status"], "missing_response")

    def test_stale_uses_header_and_exact_24h_boundary(self):
        self.log(header="2026-09-05 11:59:59")
        self.assertEqual(self.collect()["status"], "stale")
        self.log(header="2026-09-05 12:00:00")
        self.assertEqual(self.collect()["status"], "ok")

    def test_read_error_latest_never_falls_back(self):
        self.log("Guter alter Bericht", name="2026-09-05_23-59-59.md")
        latest = self.log()
        latest.write_bytes(b"\xff\xfe")
        result = self.collect()
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["path"], str(latest))
        self.assertNotIn("Guter alter Bericht", result["response"])
        latest.unlink()
        latest.mkdir()
        self.assertEqual(self.collect()["status"], "error")

    def test_header_date_fallback_and_timezone(self):
        self.log(header="kein Datum", prompt="**Run Time:** 1999-01-01 00:00:00")
        result = self.collect()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["run_at"], "2026-09-06T03:03:42+02:00")
        self.log(header="2026-09-06T01:03:42+00:00")
        self.assertEqual(self.collect()["run_at"], "2026-09-06T03:03:42+02:00")
        self.log(header="2026-09-06T01:03:42Z")
        self.assertEqual(self.collect()["run_at"], "2026-09-06T03:03:42+02:00")

    def test_overlong_response_keeps_sources_tail_and_marks_omission(self):
        tail = "\n## Quellen\nhttps://example.org/letzter-beleg"
        self.log("Anfang\n" + "Ä" * 17000 + tail)
        result = self.collect()
        self.assertEqual(result["status"], "truncated")
        self.assertTrue(result["truncated"])
        self.assertLessEqual(len(result["response"]), 14000)
        self.assertTrue(result["response"].startswith("Anfang"))
        self.assertTrue(result["response"].endswith(tail))
        self.assertIn("gekürzt", result["response"])
        self.assertIn(result["path"], result["response"])
        self.log("X" * 14000)
        self.assertEqual(self.collect()["status"], "ok")
        self.assertFalse(self.collect()["truncated"])

    def test_newer_failed_source_run_overrides_old_success(self):
        path = self.log("Alter Erfolg")
        jobs = self.home / "cron" / "jobs.json"
        jobs.write_text(json.dumps({"jobs": [{"id": JOB, "last_status": "failure", "last_run_at": "2026-09-06T10:00:00+02:00"}]}))
        result = self.collect()
        self.assertEqual(result["status"], "source_failed")
        self.assertEqual(result["source_last_status"], "failure")
        self.assertEqual(result["run_at"], "2026-09-06T10:00:00+02:00")
        self.assertEqual(result["log_run_at"], "2026-09-06T03:03:42+02:00")
        self.assertEqual(result["path"], str(path))
        self.assertNotIn("Alter Erfolg", result["response"])
        path.unlink()
        self.assertEqual(self.collect()["status"], "source_failed")
        self.log()
        jobs.write_text(json.dumps({"jobs": [{"id": JOB, "last_status": "failure", "last_run_at": "2026-09-05T10:00:00+02:00"}]}))
        self.assertEqual(self.collect()["status"], "ok")

    def test_broken_job_metadata_is_error_not_success(self):
        latest = self.log()
        jobs = self.home / "cron" / "jobs.json"
        for content in ("{", '{"jobs": null}', '{"jobs": [null]}', json.dumps({"jobs": [{"id": JOB, "last_status": "failure", "last_run_at": "ungültig"}]})):
            with self.subTest(content=content):
                jobs.write_text(content)
                result = self.collect()
                self.assertEqual(result["status"], "error")
                self.assertEqual(result["path"], str(latest))
                self.assertEqual(result["job_state_status"], "error")

    def test_cli_no_arguments_outputs_json_for_all_states(self):
        env = dict(os.environ, HERMES_HOME=str(self.home), PYTHONDONTWRITEBYTECODE="1")
        cases = [("missing", None), ("empty", ""), ("silent", "SILENT"), ("stale", "Historischer Bericht")]
        for expected, response in cases:
            with self.subTest(status=expected):
                if response is not None:
                    self.log(response, header="2000-01-01 00:00:00" if expected == "stale" else datetime.now(ZoneInfo("Europe/Berlin")).isoformat())
                proc = subprocess.run([sys.executable, "-B", str(SCRIPT)], env=env, capture_output=True, text=True, timeout=10)
                self.assertEqual(proc.returncode, 0, proc.stderr)
                self.assertEqual(proc.stderr, "")
                self.assertTrue(proc.stdout.strip(), "stdout darf niemals leer sein")
                result = json.loads(proc.stdout)
                self.assertEqual(result["status"], expected)
                self.assertTrue(result["response"].strip())

    def test_script_is_executable_without_arguments(self):
        self.assertTrue(os.access(SCRIPT, os.X_OK), "Helper muss direkt ausführbar sein")
        env = dict(os.environ, HERMES_HOME=str(self.home), PYTHONDONTWRITEBYTECODE="1")
        proc = subprocess.run([str(SCRIPT)], env=env, capture_output=True, text=True, timeout=10)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout)["status"], "missing")

    def test_output_directory_read_error_is_not_missing(self):
        self.logs.rmdir()
        self.logs.write_text("Kein Verzeichnis")
        result = self.collect()
        self.assertEqual(result["status"], "error")

    def test_only_top_header_sets_run_time_even_without_prompt(self):
        path = self.log()
        path.write_text("# Cron Job: recherche\n\n## Response\n**Run Time:** 1999-01-01 00:00:00\nBericht")
        result = self.collect()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["run_at"], "2026-09-06T03:03:42+02:00")
        path.write_text("# Cron Job: recherche\n**Run Time:** 2026-09-06 04:00:00\n## Prompt\nUnvollständiges Log")
        result = self.collect()
        self.assertEqual(result["status"], "missing_response")
        self.assertEqual(result["run_at"], "2026-09-06T04:00:00+02:00")


if __name__ == "__main__":
    unittest.main()

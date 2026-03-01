import subprocess
import sys

def test_script_runs():
    r = subprocess.run([sys.executable, "test_processor.py"], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr

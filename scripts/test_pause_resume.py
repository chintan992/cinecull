import os
import sys

# Ensure project root is in python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from fastapi.testclient import TestClient
except ImportError:
    print("[INFO] Installing 'httpx' for TestClient support...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "httpx"])
    from fastapi.testclient import TestClient

from main import app, state

client = TestClient(app)

def test_pause_resume():
    print("Running pause/resume API integration tests...")
    
    # 1. Reset state
    state["analysis_paused"] = False
    state["analysis_queue"] = []
    
    # 2. Test initial status
    response = client.get("/api/analysis/status")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    assert response.json() == {"paused": False, "queue_len": 0}, f"Unexpected response: {response.json()}"
    print("  -> Initial status check passed.")
    
    # 3. Test pause
    response = client.post("/api/analysis/pause")
    assert response.status_code == 200
    assert response.json() == {"status": "success", "paused": True}
    assert state["analysis_paused"] is True
    print("  -> Pause request check passed.")
    
    # 4. Test status when paused
    response = client.get("/api/analysis/status")
    assert response.json() == {"paused": True, "queue_len": 0}
    print("  -> Paused status check passed.")
    
    # 5. Test scan directory while paused
    state["watch_dir"] = os.path.abspath("test_photos")
    response = client.post("/api/photos/scan")
    assert response.status_code == 200
    data = response.json()
    assert data["paused"] is True, f"Expected paused: True, got {data}"
    assert len(state["analysis_queue"]) > 0
    print(f"  -> Scan directory during pause check passed ({len(state['analysis_queue'])} items queued).")
    
    # 6. Test status with queued items
    q_len = len(state["analysis_queue"])
    response = client.get("/api/analysis/status")
    assert response.json() == {"paused": True, "queue_len": q_len}
    print("  -> Queue length status check passed.")
    
    # 7. Test resume
    response = client.post("/api/analysis/resume")
    assert response.status_code == 200
    assert response.json() == {"status": "success", "paused": False}
    assert state["analysis_paused"] is False
    print("  -> Resume request check passed.")
    
    print("\nAll API pause/resume unit tests passed successfully!")

if __name__ == "__main__":
    test_pause_resume()

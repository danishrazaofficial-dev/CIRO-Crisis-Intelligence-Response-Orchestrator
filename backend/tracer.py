import os
import json
from datetime import datetime

class CiroTracer:
    def __init__(self, traces_dir="traces"):
        self.traces_dir = traces_dir
        os.makedirs(self.traces_dir, exist_ok=True)
        self.current_trace = {}

    def start_trace(self, mode: str, location: str, language: str):
        now = datetime.now()
        trace_id = f"CIRO-{now.strftime('%Y%m%d-%H%M%S')}"
        self.current_trace = {
            "trace_id": trace_id,
            "timestamp": now.isoformat(),
            "mode": mode,
            "location": location,
            "language": language,
            "signal_interpretation": {},
            "confidence_scoring": {},
            "priority_ranking": {},
            "resource_tradeoffs": {},
            "action_execution": {},
            "false_signal_recovery": {}
        }
        return trace_id

    def update_section(self, section_name: str, data: dict):
        if self.current_trace:
            self.current_trace[section_name] = data

    def get_current_trace(self):
        return self.current_trace

    def save_trace(self):
        if not self.current_trace:
            return
        
        timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M_%S")
        trace_filename = os.path.join(self.traces_dir, f"trace_{timestamp}.json")
        try:
            with open(trace_filename, "w", encoding="utf-8") as f:
                json.dump(self.current_trace, f, indent=2)
            print(f"[Tracer] Trace saved to {trace_filename}")
        except Exception as e:
            print(f"Failed to save trace: {e}")
        return self.current_trace

    def get_last_traces(self, count=10):
        try:
            if not os.path.exists(self.traces_dir):
                return []
            files = [os.path.join(self.traces_dir, f) for f in os.listdir(self.traces_dir) if f.endswith(".json")]
            files.sort(key=os.path.getmtime, reverse=True)
            
            traces = []
            for file_path in files[:count]:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        traces.append(json.load(f))
                except Exception as e:
                    print(f"Failed to read/parse trace file {file_path}: {e}")
            return traces
        except Exception as e:
            print(f"Failed to load recent traces list: {e}")
            return []

# Global tracer instance
ciro_tracer = CiroTracer()

import os
import json
from datetime import datetime

class CiroLogger:
    def __init__(self, logs_dir="logs"):
        self.logs_dir = logs_dir
        os.makedirs(self.logs_dir, exist_ok=True)
        self.log_filename = None

    def start_incident_log(self):
        os.makedirs(self.logs_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M_%S")
        # Save as JSON format logs for structural analysis
        self.log_filename = os.path.join(self.logs_dir, f"crisis_{timestamp}.json")
        with open(self.log_filename, "w", encoding="utf-8") as f:
            json.dump([], f)
        return self.log_filename

    def log(self, agent: str, action: str, mode: str, location: str, language: str, 
            data: str, thinking: str, decision: str, confidence: str, duration_ms: int,
            gemini_success: bool = True, fallback_used: bool = False, fallback_type: str = "none"):
        timestamp_str = datetime.now().isoformat()
        
        if not self.log_filename:
            self.start_incident_log()

        # Parse string data to object if possible to keep JSON pristine
        try:
            parsed_data = json.loads(data)
        except Exception:
            parsed_data = data

        log_record = {
            "timestamp": timestamp_str,
            "agent": agent,
            "action": action,
            "mode": mode,
            "location": location,
            "language": language,
            "gemini_success": gemini_success,
            "fallback_used": fallback_used,
            "fallback_type": fallback_type,
            "duration_ms": duration_ms,
            "confidence": confidence,
            "decision": decision,
            "thinking": thinking,
            "data": parsed_data
        }
        
        print(f"[{agent}] {action} - {decision} (Gemini Success: {gemini_success}, Fallback: {fallback_used}, {duration_ms}ms)")
        
        try:
            # Read existing logs, append and write back
            if os.path.exists(self.log_filename):
                with open(self.log_filename, "r", encoding="utf-8") as f:
                    records = json.load(f)
            else:
                records = []
                
            records.append(log_record)
            
            with open(self.log_filename, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
        except Exception as e:
            print(f"Failed to write JSON log: {e}")

# Global logger instance
ciro_logger = CiroLogger()


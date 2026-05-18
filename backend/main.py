import os
import glob
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from tracer import ciro_tracer
from logger import ciro_logger
from agents import (
    run_agent_1_signal_watcher,
    run_agent_2_crisis_detector,
    run_agent_3_resource_allocator,
    run_agent_4_communication_agent,
    run_agent_5_verification_agent,
    run_agent_6_recovery_handler
)

app = FastAPI(title="CIRO - Crisis Intelligence & Response Orchestrator API")

# Setup CORS for frontend to interact easily
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    location: str
    mode: str  # LIVE or DEMO
    scenario: Optional[str] = None # 🌊 G-10 Urban Flood, 🚗 I-8 Road Accident, etc.
    language: str # EN or UR

class ReportRequest(BaseModel):
    location: str
    description: str
    language: str

class DemoRequest(BaseModel):
    scenario: str
    language: str

# In-memory store for active crises and citizen reports
active_crises = []
citizen_reports = []

@app.get("/api/status")
def get_status():
    """Returns the list of currently active crises."""
    return {"active": active_crises}

@app.get("/api/traces")
def get_traces():
    """Returns the last 10 pipeline execution traces."""
    return ciro_tracer.get_last_traces(count=10)

@app.get("/api/logs")
def get_logs():
    """Returns the contents of the last 10 log files."""
    logs_dir = "logs"
    if not os.path.exists(logs_dir):
        return []
    
    # Scan for both .json and .txt files
    files = glob.glob(os.path.join(logs_dir, "crisis_*.*"))
    # Filter files that end with .json or .txt
    files = [f for f in files if f.endswith(".json") or f.endswith(".txt")]
    files.sort(key=os.path.getmtime, reverse=True)
    
    results = []
    for file_path in files[:10]:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            results.append({
                "filename": os.path.basename(file_path),
                "content": content,
                "created_at": os.path.getmtime(file_path)
            })
        except Exception as e:
            print(f"Error reading log file {file_path}: {e}")
            
    return results

@app.post("/api/report")
def submit_report(req: ReportRequest):
    """Citizen emergency submission endpoint."""
    report_data = {
        "id": len(citizen_reports) + 1,
        "location": req.location,
        "description": req.description,
        "language": req.language,
        "timestamp": os.environ.get("CURRENT_TIME", "2026-05-18T19:22:00")
    }
    citizen_reports.append(report_data)
    print(f"[Citizen Report] Received report: {report_data}")
    return {"success": True, "report": report_data}

@app.post("/api/analyze")
def analyze_crisis(req: AnalyzeRequest):
    """
    Executes the full 6-agent Crisis Orchestrator pipeline.
    """
    # 1. Initialize trace logging
    trace_id = ciro_tracer.start_trace(
        mode=req.mode,
        location=req.location,
        language=req.language
    )
    
    # Start incident log
    ciro_logger.start_incident_log()

    try:
        # Run Agent 1: Signal Watcher
        agent1_out = run_agent_1_signal_watcher(
            location=req.location,
            mode=req.mode,
            scenario=req.scenario,
            language=req.language
        )

        # Run Agent 2: Crisis Detector
        agent2_out = run_agent_2_crisis_detector(
            agent1_output=agent1_out,
            location=req.location,
            mode=req.mode,
            scenario=req.scenario,
            language=req.language
        )

        # Run Agent 3: Resource Allocator
        agent3_out = run_agent_3_resource_allocator(
            crisis_output=agent2_out,
            location=req.location,
            mode=req.mode,
            language=req.language
        )

        # Run Agent 4: Communication Agent
        agent4_out = run_agent_4_communication_agent(
            crisis_output=agent2_out,
            resource_output=agent3_out,
            location=req.location,
            mode=req.mode,
            language=req.language
        )

        # Compile interim execution data for verification checks
        pipeline_data = {
            "scenario": req.scenario,
            "agent1": agent1_out,
            "agent2": agent2_out,
            "agent3": agent3_out,
            "agent4": agent4_out
        }

        # Run Agent 5: Verification Agent
        agent5_out = run_agent_5_verification_agent(
            all_data=pipeline_data,
            location=req.location,
            mode=req.mode,
            language=req.language
        )

        # Run Agent 6: Recovery Handler
        agent6_out = run_agent_6_recovery_handler(
            verification_result=agent5_out,
            all_data=pipeline_data,
            location=req.location,
            mode=req.mode,
            language=req.language
        )

        # Build combined response payload
        response_payload = {
            "trace_id": trace_id,
            "mode": req.mode,
            "location": req.location,
            "language": req.language,
            "agent1": agent1_out,
            "agent2": agent2_out,
            "agent3": agent3_out,
            "agent4": agent4_out,
            "agent5": agent5_out,
            "agent6": agent6_out,
            "trace": ciro_tracer.get_current_trace()
        }

        # Keep memory of active crises
        if agent2_out.get("crisis_detected") and agent5_out.get("verification_status") != "FALSE_ALARM":
            crisis_record = {
                "id": len(active_crises) + 1,
                "location": req.location,
                "crisis_type": agent2_out.get("crisis_type"),
                "severity": agent2_out.get("severity"),
                "status": agent6_out.get("resolution_status", "ONGOING")
            }
            active_crises.append(crisis_record)

        return response_payload

    except Exception as e:
        print(f"[Pipeline Failure] Error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/demo")
def trigger_demo(req: DemoRequest):
    """
    Convenient wrapper to trigger simulated demo scenarios directly.
    """
    location = "G-10 Markaz"
    if req.scenario == "🚗 I-8 Road Accident":
        location = "I-8 Markaz"
    elif req.scenario == "🌡️ Blue Area Heatwave":
        location = "Blue Area"
        
    analyze_req = AnalyzeRequest(
        location=location,
        mode="DEMO",
        scenario=req.scenario,
        language=req.language
    )
    return analyze_crisis(analyze_req)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

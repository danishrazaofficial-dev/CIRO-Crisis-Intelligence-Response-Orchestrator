import os
import time
import json
import random
import requests
from datetime import datetime
from dotenv import load_dotenv
from rerouter import ciro_rerouter
from logger import ciro_logger
from tracer import ciro_tracer

load_dotenv()

# Simple Cache Database to store previous successful API requests
api_cache = {
    "weather": {"timestamp": 0, "data": None},
    "news": {"timestamp": 0, "data": None}
}

def clean_json_response(text: str) -> dict:
    """Helper to clean and parse Gemini JSON outputs."""
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except Exception as e:
        print(f"[Gemini Parse Error] Failed to parse: {e}\nRaw content: {text}")
        raise e

def call_gemini(prompt: str, system_instruction: str = "", language: str = "EN") -> str:
    """
    Call Gemini API using requests directly with gemini-3.1-flash-lite.
    Implements 2 retry attempts with exponential backoff and 20s timeout to prevent premature cuts on long JSONs.
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment.")

    model = "gemini-3.1-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    headers = {"Content-Type": "application/json"}
    
    # Inject language preference
    lang_instruction = ""
    if "JSON" in prompt or "json" in prompt.lower():
        lang_instruction = (
            "Respond in English." if language == "EN" else 
            "The JSON keys must ALWAYS be in English exactly as specified. Only translate the natural language string values and alert sentences to Roman Urdu."
        )
    else:
        lang_instruction = "Respond in English." if language == "EN" else "Respond in Roman Urdu."
        
    full_system_instruction = f"{system_instruction}\n{lang_instruction}"
    
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json" if "JSON" in prompt or "json" in prompt.lower() else "text/plain"
        }
    }
    
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": full_system_instruction}]}
 
    trace_attempts = []
    for attempt in range(1, 3):
        try:
            print(f"[Gemini] Requesting {model} attempt {attempt}...")
            if attempt > 1:
                time.sleep(1)
            
            response = requests.post(url, json=body, headers=headers, timeout=20)
            if response.status_code == 200:
                resp_json = response.json()
                text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                return text
            else:
                err_msg = response.json().get("error", {}).get("message", "Unknown error")
                trace_attempts.append({
                    "attempt": attempt,
                    "status": f"HTTP_{response.status_code}",
                    "error": err_msg
                })
        except Exception as e:
            trace_attempts.append({
                "attempt": attempt,
                "status": "EXCEPTION",
                "error": str(e)
            })
            
    # If all retries failed, raise exception to trigger Rule-based AI Fallback Mode
    raise RuntimeError(f"Gemini API failed after 2 attempts: {trace_attempts}")

# --- API FETCHERS WITH FALLBACK & CACHE MANAGEMENT ---

def fetch_weather() -> dict:
    """Fetches real weather for Islamabad or fallback cache/mock."""
    api_key = os.getenv("OPENWEATHER_API_KEY", "")
    lat, lon = 33.6844, 73.0479
    now = time.time()
    
    # Check cache first (5 minutes = 300s)
    if api_cache["weather"]["data"] and (now - api_cache["weather"]["timestamp"] < 300):
        print("[Weather] Using recent cached weather data.")
        return {
            "data": api_cache["weather"]["data"],
            "status": "🟢 Cached Weather Data",
            "fallback_used": True,
            "fallback_type": "cache"
        }
        
    if not api_key or api_key.startswith("AIzaSy"):
        print("[Weather] No API Key or Google Key set for Weather. Using mock weather.")
        mock_data = {"temp": 25, "humidity": 60, "rain": 0, "description": "Clear sky", "wind": 15}
        return {
            "data": mock_data,
            "status": "🔴 Weather API Key Invalid/Google Key",
            "fallback_used": True,
            "fallback_type": "mock"
        }

    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            w_data = response.json()
            rain_val = w_data.get("rain", {}).get("1h", 0)
            result_data = {
                "temp": w_data["main"]["temp"],
                "humidity": w_data["main"]["humidity"],
                "rain": rain_val,
                "description": w_data["weather"][0]["description"],
                "wind": w_data["wind"]["speed"]
            }
            api_cache["weather"] = {"timestamp": now, "data": result_data}
            return {
                "data": result_data,
                "status": "🟢 Weather API Live",
                "fallback_used": False
            }
    except Exception as e:
        print(f"[Weather] Fetch error: {e}")
        
    # Check older cache if present
    if api_cache["weather"]["data"]:
        return {
            "data": api_cache["weather"]["data"],
            "status": "🟡 Cached Weather Data",
            "fallback_used": True,
            "fallback_type": "cache"
        }
        
    # Full Mock Fallback
    mock_data = {"temp": 25, "humidity": 60, "rain": 0, "description": "Clear sky", "wind": 15}
    return {
        "data": mock_data,
        "status": "🔴 Weather API Unavailable",
        "fallback_used": True,
        "fallback_type": "mock"
    }

def fetch_news() -> dict:
    """Fetches real news for Islamabad emergency or fallback cache/mock."""
    api_key = os.getenv("NEWS_API_KEY", "")
    now = time.time()
    
    # Check cache first (5 minutes)
    if api_cache["news"]["data"] and (now - api_cache["news"]["timestamp"] < 300):
        print("[News] Using cached news.")
        return {
            "data": api_cache["news"]["data"],
            "status": "🟢 Cached News",
            "fallback_used": True,
            "fallback_type": "cache"
        }
        
    if not api_key or api_key.startswith("AIzaSy"):
        mock_articles = ["Islamabad traffic update", "Weather advisory Islamabad", "NDMA monitoring situation"]
        return {
            "data": mock_articles,
            "status": "🔴 News API Key Invalid/Google Key",
            "fallback_used": True,
            "fallback_type": "mock"
        }

    try:
        url = f"https://newsapi.org/v2/everything?q=Islamabad+(flood+OR+accident+OR+emergency+OR+crisis+OR+traffic)&apiKey={api_key}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            articles = [a["title"] for a in response.json().get("articles", [])[:5]]
            if not articles:
                articles = ["No active emergency articles found for Islamabad."]
            api_cache["news"] = {"timestamp": now, "data": articles}
            return {
                "data": articles,
                "status": "🟢 News API Live",
                "fallback_used": False
            }
    except Exception as e:
        print(f"[News] Fetch error: {e}")

    if api_cache["news"]["data"]:
        return {
            "data": api_cache["news"]["data"],
            "status": "🟡 Cached News",
            "fallback_used": True,
            "fallback_type": "cache"
        }

    mock_articles = ["Islamabad traffic update", "Weather advisory Islamabad", "NDMA monitoring situation"]
    return {
        "data": mock_articles,
        "status": "🔴 News API Unavailable",
        "fallback_used": True,
        "fallback_type": "mock"
    }

# --- SPECIAL SIGNAL SCORING (SECTION 17) ---

def calculate_credibility_breakdown(signals: list, location: str) -> dict:
    """
    SECTION 17 — CREDIBILITY BREAKDOWN
    geolocation_confidence: exact sector 95, sector only 80, landmark 60, vague 30, none 0
    urgency_score: emergency +30, critical +25, urgent +25, immediate +20, help +20, SOS +30 (cap 100)
    mention_velocity: 0-5 min: 90, 5-15 min: 60, 15-30 min: 30, 30+: 10
    """
    # Location logic
    geo_confidence = 30
    loc_lower = location.lower()
    if any(sector in loc_lower for sector in ["g-10", "f-7", "i-8", "blue area"]):
        geo_confidence = 95
    elif "north" in loc_lower or "south" in loc_lower or "east" in loc_lower or "west" in loc_lower:
        geo_confidence = 80
    elif any(landmark in loc_lower for landmark in ["centaurus", "faisal mosque", "kohsar"]):
        geo_confidence = 60
    elif not location:
        geo_confidence = 0

    scores = {}
    total_score = 0
    
    for idx, text in enumerate(signals):
        txt_lower = text.lower()
        
        # Urgency Calculation
        urgency = 0
        if "emergency" in txt_lower: urgency += 30
        if "critical" in txt_lower: urgency += 25
        if "urgent" in txt_lower: urgency += 25
        if "immediate" in txt_lower: urgency += 20
        if "help" in txt_lower: urgency += 20
        if "sos" in txt_lower: urgency += 30
        urgency = min(urgency, 100)
        
        # Mention velocity
        velocity = random.choice([90, 60, 30, 10])
        
        # Credibility factors
        cred = 50 # base
        if any(sector in txt_lower for sector in ["g-10", "f-7", "i-8", "blue area"]): cred += 20
        if len(text) > 40: cred += 15 # specific details included
        if "official" in txt_lower or "wasa" in txt_lower or "ndma" in txt_lower: cred += 20
        if "maybe" in txt_lower or "some" in txt_lower: cred -= 20
        
        cred = max(0, min(100, cred))
        scores[f"signal_{idx+1}"] = {
            "text": text,
            "geolocation_confidence": geo_confidence,
            "urgency_score": urgency,
            "mention_velocity": velocity,
            "credibility_score": cred
        }
        total_score += cred
        
    avg_risk = int(total_score / len(signals)) if signals else 50
    return {
        "breakdown": scores,
        "combined_risk_score": avg_risk
    }

# --- SIX AI AGENTS ---

def run_agent_1_signal_watcher(location: str, mode: str, scenario: str, language: str) -> dict:
    """
    AGENT 1 — Signal Watcher (Blue)
    Fetches weather, news, and generates citizen social posts.
    """
    start_time = time.time()
    fallback_badges = []
    
    # 1. Fetch weather
    if mode == "DEMO":
        if scenario == "🌊 G-10 Urban Flood":
            weather = {"temp": 19, "humidity": 95, "rain": 22, "description": "Heavy thunderstorm", "wind": 55}
        elif scenario == "🚗 I-8 Road Accident":
            weather = {"temp": 22, "humidity": 80, "rain": 3, "description": "Drizzle", "wind": 12}
        elif scenario == "🌡️ Blue Area Heatwave":
            weather = {"temp": 46, "humidity": 12, "rain": 0, "description": "Extreme heat", "heat_index": 52, "wind": 8}
        else: # False Alarm
            weather = {"temp": 19, "humidity": 95, "rain": 22, "description": "Heavy thunderstorm", "wind": 55}
        weather_status = "🟢 Simulated Weather"
    else:
        weather_res = fetch_weather()
        weather = weather_res["data"]
        weather_status = weather_res["status"]
        if weather_res.get("fallback_used"):
            fallback_badges.append(weather_status)

    # 2. Fetch news
    if mode == "DEMO":
        if scenario == "🌊 G-10 Urban Flood":
            news = ["G-10 waterlogging reported", "Srinagar Highway closed", "WASA teams deployed G-10"]
        elif scenario == "🚗 I-8 Road Accident":
            news = ["Multi-vehicle collision I-8", "3 injured, ambulance called", "I-8 Markaz traffic jammed"]
        elif scenario == "🌡️ Blue Area Heatwave":
            news = ["Heatwave emergency Blue Area", "Heatstroke cases in hospitals", "NDMA advisory issued"]
        else: # False Alarm
            news = ["G-10 waterlogging reported", "Srinagar Highway closed", "WASA teams deployed G-10"]
        news_status = "🟢 Simulated News"
    else:
        news_res = fetch_news()
        news = news_res["data"]
        news_status = news_res["status"]
        if news_res.get("fallback_used"):
            fallback_badges.append(news_status)

    # 3. Generate social media posts via Gemini
    social_posts = []
    social_status = "🟢 Simulated Social"
    
    social_prompt = (
        f"Based on weather conditions: {weather['description']} with {weather.get('rain', 0)}mm rain, "
        f"temp {weather['temp']}C in {location} Islamabad, generate 4 short authentic citizen social media posts reporting live status. "
        f"Return as a JSON array of strings only. "
        f"Language: {language}"
    )
    
    try:
        raw_social = call_gemini(
            social_prompt, 
            system_instruction="You are a local Islamabad citizen posting live status updates on social media.",
            language=language
        )
        social_posts = clean_json_response(raw_social)
        gemini_success = True
        fallback_used = False
        fallback_type = "none"
    except Exception as e:
        print(f"[Agent 1] Gemini post generation failed, using fallback templates: {e}")
        social_posts = [
            f"Halat kharab hain yahan {location} mein!",
            f"Heavy rain here, roads look like streams.",
            f"Stay safe guys, water level is rising.",
            f"Traffic is completely jammed near {location}."
        ]
        fallback_badges.append("⚠️ Social Simulation Fallback")
        gemini_success = False
        fallback_used = True
        fallback_type = "social_mock"

    # 4. Score credibility
    combined_signals = news + social_posts
    cred_breakdown = calculate_credibility_breakdown(combined_signals, location)

    # Calculate time taken
    duration_ms = int((time.time() - start_time) * 1000)

    # Generate signal_interpretation trace entry
    credibility_scores = {f"signal_{i+1}": val["credibility_score"] for i, val in enumerate(cred_breakdown["breakdown"].values())}
    
    trace_entry = {
        "agent": "Signal Watcher",
        "raw_signals": {
            "weather": weather,
            "news": news,
            "social": social_posts
        },
        "interpretation": f"Weather status: {weather['description']} combined with {len(news)} news articles and citizen social reports indicates localized patterns.",
        "credibility_scores": credibility_scores,
        "combined_risk_score": cred_breakdown["combined_risk_score"],
        "time_ms": duration_ms
    }
    
    ciro_tracer.update_section("signal_interpretation", trace_entry)
    
    ciro_logger.log(
        agent="Signal Watcher",
        action="FETCH_AND_INTERPRET",
        mode=mode,
        location=location,
        language=language,
        data=json.dumps({"weather": weather, "news": news}),
        thinking=trace_entry["interpretation"],
        decision=f"Combined Risk Score calculated: {cred_breakdown['combined_risk_score']}%",
        confidence="95",
        duration_ms=duration_ms,
        gemini_success=gemini_success,
        fallback_used=fallback_used,
        fallback_type=fallback_type
    )

    return {
        "weather": weather,
        "news": news,
        "social": social_posts,
        "credibility": cred_breakdown,
        "combined_risk_score": cred_breakdown["combined_risk_score"],
        "fallback_badges": fallback_badges
    }

def run_agent_2_crisis_detector(agent1_output: dict, location: str, mode: str, scenario: str, language: str) -> dict:
    """
    AGENT 2 — Crisis Detector (Orange)
    Analyzes signals to detect, classify and score severity of any crisis.
    """
    start_time = time.time()
    fallback_used = False
    fallback_type = ""
    
    detector_prompt = (
        f"Analyze all signals for {location}:\n"
        f"Weather: {json.dumps(agent1_output['weather'])}\n"
        f"News: {json.dumps(agent1_output['news'])}\n"
        f"Social: {json.dumps(agent1_output['social'])}\n"
        f"Combined Risk Score: {agent1_output['combined_risk_score']}\n"
        f"Return EXACTLY in this JSON format:\n"
        f"{{\n"
        f"  \"crisis_detected\": true/false,\n"
        f"  \"crisis_type\": \"FLOOD\"/\"ACCIDENT\"/\"HEATWAVE\"/\"ROAD_BLOCKAGE\"/\"POWER_OUTAGE\"/\"PROTEST\"/\"NO_CRISIS\",\n"
        f"  \"severity\": 1-10,\n"
        f"  \"confidence\": 0-100,\n"
        f"  \"affected_radius_km\": number,\n"
        f"  \"affected_population\": number,\n"
        f"  \"expected_duration_hours\": number,\n"
        f"  \"peak_impact_time\": \"string\",\n"
        f"  \"reasoning\": \"string\",\n"
        f"  \"reasoning_chain\": [\"step1\",\"step2\"...],\n"
        f"  \"contradictions_found\": [],\n"
        f"  \"spread_risk\": \"LOW\"/\"MEDIUM\"/\"HIGH\",\n"
        f"  \"road_likely_blocked\": true/false,\n"
        f"  \"blocked_road_name\": \"string or null\"\n"
        f"}}\n"
        f"Language instruction: {language}"
    )

    system_instruction = (
        "Expert crisis detection AI Islamabad Pakistan. Be realistic. Weak signals = NO_CRISIS. "
        "Historical: G-10/G-11 flood often, Faizabad protests, Blue Area traffic, I-8 accidents common."
    )

    raw_response = ""
    gemini_unavailable = False

    try:
        raw_response = call_gemini(detector_prompt, system_instruction=system_instruction, language=language)
        result = clean_json_response(raw_response)
    except Exception as e:
        # GEMINI FALLBACK (SECTION 17)
        print(f"[Agent 2] Gemini detection failed. Using Rule-Based fallback. Error: {e}")
        fallback_used = True
        fallback_type = "RULE_BASED"
        gemini_unavailable = True
        
        # Rule-based classification
        text_corpus = " ".join(agent1_output["news"] + agent1_output["social"]).lower()
        
        crisis_type = "NO_CRISIS"
        road_likely_blocked = False
        blocked_road_name = None
        severity = 2
        
        if "flood" in text_corpus or "pani" in text_corpus or "waterlog" in text_corpus or agent1_output["weather"].get("rain", 0) > 10:
            crisis_type = "FLOOD"
            road_likely_blocked = True
            blocked_road_name = "Srinagar Highway"
            severity = 8 if agent1_output["weather"].get("rain", 0) > 20 else 5
        elif "accident" in text_corpus or "crash" in text_corpus or "collision" in text_corpus:
            crisis_type = "ACCIDENT"
            road_likely_blocked = True
            blocked_road_name = "I-8 Markaz main road"
            severity = 6
        elif "heat" in text_corpus or "garmi" in text_corpus or "heatwave" in text_corpus or agent1_output["weather"].get("temp", 0) > 40:
            crisis_type = "HEATWAVE"
            severity = 8
        elif "protest" in text_corpus or "dharna" in text_corpus:
            crisis_type = "PROTEST"
            severity = 7
        elif "power" in text_corpus or "outage" in text_corpus or "bijli" in text_corpus:
            crisis_type = "POWER_OUTAGE"
            severity = 4

        result = {
            "crisis_detected": crisis_type != "NO_CRISIS",
            "crisis_type": crisis_type,
            "severity": severity,
            "confidence": 80,
            "affected_radius_km": 2.5,
            "affected_population": 15000,
            "expected_duration_hours": 6,
            "peak_impact_time": "Now",
            "reasoning": "Detected via rule-based keyword match due to AI service disruption",
            "reasoning_chain": [
                f"Step 1: Rain/signals analyzed",
                f"Step 2: Keyword match for {crisis_type}",
                f"Step 3: Fallback safety protocol triggered"
            ],
            "contradictions_found": [],
            "spread_risk": "MEDIUM",
            "road_likely_blocked": road_likely_blocked,
            "blocked_road_name": blocked_road_name
        }

    duration_ms = int((time.time() - start_time) * 1000)

    # 5 sections confidence scoring breakdown
    confidence_breakdown = {
        "weather_signal_weight": 40,
        "news_signal_weight": 35,
        "social_signal_weight": 25,
        "historical_context_bonus": 10,
        "contradiction_penalty": 0 if not result.get("contradictions_found") else -20,
        "final_confidence": result["confidence"]
    }

    # Generate confidence_scoring trace
    trace_entry = {
        "agent": "Crisis Detector",
        "gemini_input": {"prompt": detector_prompt, "system": system_instruction},
        "gemini_raw_response": raw_response if raw_response else result,
        "confidence_breakdown": confidence_breakdown,
        "crisis_classified": result["crisis_type"],
        "severity": result["severity"],
        "reasoning_chain": result["reasoning_chain"],
        "time_ms": duration_ms,
        "fallback_used": fallback_used,
        "fallback_type": fallback_type,
        "gemini_unavailable": gemini_unavailable
    }
    
    ciro_tracer.update_section("confidence_scoring", trace_entry)

    ciro_logger.log(
        agent="Crisis Detector",
        action="CLASSIFY_CRISIS",
        mode=mode,
        location=location,
        language=language,
        data=json.dumps(result),
        thinking=result["reasoning"],
        decision=f"Classified as {result['crisis_type']} (Severity: {result['severity']}/10)",
        confidence=str(result["confidence"]),
        duration_ms=duration_ms,
        gemini_success=not gemini_unavailable,
        fallback_used=fallback_used,
        fallback_type=fallback_type
    )

    if fallback_used:
        result["fallback_badge"] = "⚠️ AI Fallback Mode"
    return result

def run_agent_3_resource_allocator(crisis_output: dict, location: str, mode: str, language: str) -> dict:
    """
    AGENT 3 — Resource Allocator (Yellow)
    Allocates available emergency responders & determines priority weights.
    Triggers Rerouting Agent if there is a road blockage.
    """
    start_time = time.time()
    
    available_resources = {
        "ambulances": 10,
        "police": 8,
        "rescue": 5,
        "fire_brigade": 4,
        "water_tankers": 3,
        "drones": 2
    }

    # Call Gemini to compute trade-offs & allocations
    allocation_prompt = (
        f"Allocate Islamabad emergency resources for this crisis at {location}:\n"
        f"{json.dumps(crisis_output)}\n"
        f"Available Resources: {json.dumps(available_resources)}\n"
        f"Rules:\n"
        f"- Min 2 ambulances standby always\n"
        f"- Severity 1-3: monitor only\n"
        f"- Severity 4-6: partial deploy\n"
        f"- Severity 7-10: maximum deploy\n"
        f"Provide EXACTLY this JSON format:\n"
        f"{{\n"
        f"  \"priority_score\": 0-100,\n"
        f"  \"ranking_logic\": [\"step1\", \"step2\"],\n"
        f"  \"tradeoff_analysis\": [\"tradeoff1\", \"tradeoff2\"],\n"
        f"  \"final_allocation\": {{\n"
        f"     \"ambulances\": number,\n"
        f"     \"police\": number,\n"
        f"     \"rescue\": number,\n"
        f"     \"fire_brigade\": number,\n"
        f"     \"water_tankers\": number,\n"
        f"     \"drones\": number\n"
        f"  }},\n"
        f"  \"standby_resources\": {{\n"
        f"     \"ambulances\": number,\n"
        f"     \"police\": number,\n"
        f"     \"rescue\": number,\n"
        f"     \"fire_brigade\": number,\n"
        f"     \"water_tankers\": number,\n"
        f"     \"drones\": number\n"
        f"  }}\n"
        f"}}\n"
        f"Language instruction: {language}"
    )

    try:
        raw_alloc = call_gemini(allocation_prompt, system_instruction="Strategic emergency response operations commander.", language=language)
        result = clean_json_response(raw_alloc)
        gemini_success = True
        fallback_used = False
        fallback_type = "none"
    except Exception as e:
        print(f"[Agent 3] Resource allocation Gemini call failed: {e}")
        # Rule-based fallback allocation
        sev = crisis_output.get("severity", 5)
        allocated = {
            "ambulances": 0,
            "police": 0,
            "rescue": 0,
            "fire_brigade": 0,
            "water_tankers": 0,
            "drones": 0
        }
        
        if crisis_output.get("crisis_detected"):
            if sev >= 7:
                allocated = {"ambulances": 6, "police": 5, "rescue": 4, "fire_brigade": 3, "water_tankers": 2, "drones": 1}
            elif sev >= 4:
                allocated = {"ambulances": 4, "police": 3, "rescue": 2, "fire_brigade": 1, "water_tankers": 1, "drones": 1}
            else:
                allocated = {"ambulances": 1, "police": 1, "rescue": 1, "fire_brigade": 0, "water_tankers": 0, "drones": 0}
                
        # Standby calculation
        standby = {k: available_resources[k] - allocated[k] for k in available_resources}
        
        result = {
            "priority_score": sev * 10,
            "ranking_logic": [
                f"Rule-based fallback calculation based on severity {sev}",
                f"Ensure minimum 2 standby ambulances are reserved."
            ],
            "tradeoff_analysis": [
                "Allocating basic resources to contain localized emergency",
                "Holding rest on standby to ensure city wide safety"
            ],
            "final_allocation": allocated,
            "standby_resources": standby
        }
        gemini_success = False
        fallback_used = True
        fallback_type = "RULE_BASED"

    duration_ms = int((time.time() - start_time) * 1000)

    # Trigger traffic rerouting agent if road blocked
    reroute_data = {}
    if crisis_output.get("road_likely_blocked") and crisis_output.get("blocked_road_name"):
        blocked = crisis_output["blocked_road_name"]
        print(f"[Agent 3] Road blockage detected on '{blocked}'. Triggering Rerouter.")
        reroute_data = ciro_rerouter.calculate_reroute(blocked, language=language)

    # Update Priority Ranking Trace
    priority_trace = {
        "agent": "Resource Allocator",
        "active_crises": [
            {"id": 1, "location": location, "severity": crisis_output.get("severity", 5)}
        ],
        "ranking_logic": result["ranking_logic"],
        "priority_scores": {
            location: result["priority_score"]
        },
        "time_ms": int(duration_ms * 0.4)
    }
    ciro_tracer.update_section("priority_ranking", priority_trace)

    # Update Resource Tradeoffs Trace
    tradeoffs_trace = {
        "agent": "Resource Allocator",
        "available": available_resources,
        "tradeoff_analysis": result["tradeoff_analysis"],
        "final_allocation": {
            "active_crisis": result["final_allocation"],
            "standby": result["standby_resources"]
        },
        "time_ms": int(duration_ms * 0.6)
    }
    ciro_tracer.update_section("resource_tradeoffs", tradeoffs_trace)

    ciro_logger.log(
        agent="Resource Allocator",
        action="ALLOCATE_RESOURCES",
        mode=mode,
        location=location,
        language=language,
        data=json.dumps(result["final_allocation"]),
        thinking=" / ".join(result["tradeoff_analysis"]),
        decision=f"Priority Score: {result['priority_score']}%",
        confidence="90",
        duration_ms=duration_ms,
        gemini_success=gemini_success,
        fallback_used=fallback_used,
        fallback_type=fallback_type
    )

    return {
        "allocation": result,
        "reroute": reroute_data
    }

def run_agent_4_communication_agent(crisis_output: dict, resource_output: dict, location: str, mode: str, language: str) -> dict:
    """
    AGENT 4 — Communication Agent (Green)
    Generates tailored warning bulletins for all stakeholders.
    """
    start_time = time.time()
    reroute_info = resource_output.get("reroute", {})
    blocked_road_str = f"Blocked road: {reroute_info.get('blocked_road')}" if reroute_info else "No road blockages reported."

    comm_prompt = (
        f"Generate stakeholder alerts for this crisis at {location} Islamabad:\n"
        f"Crisis Info: {json.dumps(crisis_output)}\n"
        f"Resource Allocations: {json.dumps(resource_output['allocation']['final_allocation'])}\n"
        f"Rerouting Info: {blocked_road_str}\n"
        f"Return EXACTLY in this JSON format:\n"
        f"{{\n"
        f"  \"PUBLIC\": \"Simple urgent language warning public\",\n"
        f"  \"HOSPITAL\": \"Medical preparation request for PIMS/hospital staff\",\n"
        f"  \"POLICE\": \"Law enforcement mobilization & traffic direction instruction\",\n"
        f"  \"WASA\": \"WASA/municipal infrastructure cleanup task force instructions\",\n"
        f"  \"MEDIA\": \"Official press statement releases\"\n"
        f"}}\n"
        f"Language instruction: {language}"
    )

    try:
        raw_comm = call_gemini(comm_prompt, system_instruction="Official Crisis Communications Officer.", language=language)
        result = clean_json_response(raw_comm)
        gemini_success = True
        fallback_used = False
        fallback_type = "none"
    except Exception as e:
        print(f"[Agent 4] Communication generation failed: {e}")
        # Custom Roman Urdu / English static fallback
        if language == "UR":
            result = {
                "PUBLIC": f"ALERT: {location} mein emergency halat hain. Srinagar Highway band hai, munasib rasta ikhtiyar karein.",
                "HOSPITAL": f"HOSPITAL ALERT: emergency cases expected from {location}. Standby protocol activated.",
                "POLICE": f"POLICE ORDER: Deploy units to G-10 and Faizabad to regulate traffic immediately.",
                "WASA": "WASA task force dispatched to G-10 to clear standing waterlogging.",
                "MEDIA": f"Official NDMA Release: Responders are handling an incident in {location}."
            }
        else:
            result = {
                "PUBLIC": f"ALERT: Crisis detected at {location}. Srinagar Highway blocked. Avoid the route and drive safe.",
                "HOSPITAL": f"HOSPITAL NOTIFICATION: Prepare PIMS & adjacent units for incoming emergencies.",
                "POLICE": f"POLICE ACTION: Mobilize squads to {location} for security and routing.",
                "WASA": "WASA alert dispatched for drainage clear-out tasks.",
                "MEDIA": "NDMA Press Release: Action is being taken to control the emergency."
            }
        gemini_success = False
        fallback_used = True
        fallback_type = "STATIC_BILINGUAL"

    duration_ms = int((time.time() - start_time) * 1000)

    # Update Action Execution Trace
    actions_taken = [
        {"action": "PUBLIC_ALERT_SENT", "target": "General Public", "message": result["PUBLIC"], "timestamp": datetime.now().strftime("%H:%M:%S"), "status": "EXECUTED"},
        {"action": "HOSPITAL_NOTIFIED", "target": "PIMS Hospital", "message": result["HOSPITAL"], "timestamp": datetime.now().strftime("%H:%M:%S"), "status": "EXECUTED"},
        {"action": "POLICE_DEPLOYED", "target": "Islamabad Traffic Police", "message": result["POLICE"], "timestamp": datetime.now().strftime("%H:%M:%S"), "status": "EXECUTED"},
        {"action": "WASA_NOTIFIED", "target": "WASA Emergency Team", "message": result["WASA"], "timestamp": datetime.now().strftime("%H:%M:%S"), "status": "EXECUTED"}
    ]
    
    if reroute_info:
        actions_taken.append({
            "action": "TRAFFIC_REROUTED",
            "target": reroute_info.get("blocked_road", "Highway"),
            "blocked_route": reroute_info.get("blocked_road"),
            "alternative_1": reroute_info.get("alternatives", [{}])[0].get("name", "Alternative Route"),
            "alternative_2": reroute_info.get("alternatives", [{}])[1].get("name", "Alternative Route"),
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "status": "EXECUTED"
        })

    trace_entry = {
        "agent": "Communication Agent",
        "actions_taken": actions_taken,
        "time_ms": duration_ms
    }
    ciro_tracer.update_section("action_execution", trace_entry)

    ciro_logger.log(
        agent="Communication Agent",
        action="BROADCAST_COMMUNICATIONS",
        mode=mode,
        location=location,
        language=language,
        data=json.dumps(result),
        thinking="Public warning broadcasts issued via SMS/Social streams.",
        decision="All communication streams triggered successfully",
        confidence="98",
        duration_ms=duration_ms,
        gemini_success=gemini_success,
        fallback_used=fallback_used,
        fallback_type=fallback_type
    )

    return result

def run_agent_5_verification_agent(all_data: dict, location: str, mode: str, language: str) -> dict:
    """
    AGENT 5 — Verification Agent (Purple)
    Validates signals, checks for contradictions and determines if false alarm recovery is triggered.
    """
    start_time = time.time()
    
    # Check if the user selected the False Alarm Recovery scenario in Demo Mode
    is_false_alarm_scenario = (mode == "DEMO" and "False Alarm" in all_data.get("scenario", ""))

    verification_prompt = (
        f"Verify this emergency response pipeline data for {location}:\n"
        f"Pipeline details: {json.dumps(all_data)}\n"
        f"Analyze for gaps, contradictions, or single-source errors.\n"
        f"Return EXACTLY in this JSON format:\n"
        f"{{\n"
        f"  \"verification_status\": \"CONFIRM\"/\"DOWNGRADE\"/\"UPGRADE\"/\"HOLD\"/\"FALSE_ALARM\",\n"
        f"  \"contradiction_found\": true/false,\n"
        f"  \"conflict_details\": {{\n"
        f"     \"signal_A\": \"string description\",\n"
        f"     \"signal_B\": \"string description\",\n"
        f"     \"contradiction_score\": 0-100\n"
        f"  }},\n"
        f"  \"recovery_reason\": \"string\"\n"
        f"}}\n"
        f"Language instruction: {language}"
    )

    try:
        # If explicitly simulated false alarm, force FALSE_ALARM verification status
        if is_false_alarm_scenario:
            result = {
                "verification_status": "FALSE_ALARM",
                "contradiction_found": True,
                "conflict_details": {
                    "signal_A": "Social media reports heavy G-10 flooding",
                    "signal_B": "Field officer report: Main water pipe burst only, no rain flooding",
                    "contradiction_score": 78
                },
                "recovery_reason": "Field confirmation indicates urban flooding reports were actually a main burst line."
            }
            gemini_success = True
            fallback_used = False
            fallback_type = "none"
        else:
            raw_verify = call_gemini(verification_prompt, system_instruction="Rigorous Crisis Intelligence Verification Auditor.", language=language)
            result = clean_json_response(raw_verify)
            gemini_success = True
            fallback_used = False
            fallback_type = "none"
    except Exception as e:
        print(f"[Agent 5] Verification Gemini call failed: {e}")
        # Default verification confirm fallback
        result = {
            "verification_status": "CONFIRM",
            "contradiction_found": False,
            "conflict_details": {
                "signal_A": "None",
                "signal_B": "None",
                "contradiction_score": 0
            },
            "recovery_reason": "No contradicting reports found. Confirmed crisis situation."
        }
        gemini_success = False
        fallback_used = True
        fallback_type = "CONFIRM_FALLBACK"

    duration_ms = int((time.time() - start_time) * 1000)

    # If FALSE_ALARM verification status is detected, prepare False Signal Recovery trace structure
    if result["verification_status"] == "FALSE_ALARM":
        recovery_trace = {
            "agent": "Verification Agent",
            "trigger": "Field report contradicts flood alert",
            "conflict_detected": result["conflict_details"],
            "recovery_steps": [
                "Step 1: Contradiction flagged — confidence drops",
                "Step 2: Hold alert — do not escalate",
                "Step 3: Request field verification",
                "Step 4: Field confirms water main burst",
                "Step 5: Reclassify to INFRASTRUCTURE",
                "Step 6: Retract flood alert",
                "Step 7: Release flood resources",
                "Step 8: Notify WASA instead",
                "Step 9: Send correction to public",
                "Step 10: Log false alarm in system"
            ],
            "alert_retracted": True,
            "correction_sent": True,
            "resources_released": {"ambulances": 5, "rescue": 3},
            "time_ms": duration_ms
        }
        ciro_tracer.update_section("false_signal_recovery", recovery_trace)
    else:
        # Default empty section
        ciro_tracer.update_section("false_signal_recovery", {
            "agent": "Verification Agent",
            "trigger": "None",
            "conflict_detected": {},
            "recovery_steps": [],
            "alert_retracted": False,
            "time_ms": duration_ms
        })

    ciro_logger.log(
        agent="Verification Agent",
        action="VERIFY_CRISIS_INTELLIGENCE",
        mode=mode,
        location=location,
        language=language,
        data=json.dumps(result),
        thinking=result["recovery_reason"],
        decision=f"Verification status: {result['verification_status']}",
        confidence="95",
        duration_ms=duration_ms,
        gemini_success=gemini_success,
        fallback_used=fallback_used,
        fallback_type=fallback_type
    )

    return result

def run_agent_6_recovery_handler(verification_result: dict, all_data: dict, location: str, mode: str, language: str) -> dict:
    """
    AGENT 6 — Recovery Handler (Cyan)
    Handles resolution or retraction of the crisis emergency state.
    """
    start_time = time.time()
    status = verification_result.get("verification_status", "CONFIRM")

    recovery_prompt = (
        f"Generate emergency resolution release for this crisis at {location}:\n"
        f"Status: {status}\n"
        f"Return EXACTLY in this JSON format:\n"
        f"{{\n"
        f"  \"resolution_status\": \"RESOLVED\"/\"RETRACTED\"/\"ONGOING\",\n"
        f"  \"public_all_clear\": \"Friendly ROMAN URDU or English notification message\",\n"
        f"  \"wasa_municipal_status\": \"WASA technical handover statement\",\n"
        f"  \"reopen_routes_animation_trigger\": true/false,\n"
        f"  \"recovery_lessons_logged\": [\"lesson1\", \"lesson2\"]\n"
        f"}}\n"
        f"Language instruction: {language}"
    )

    try:
        raw_recovery = call_gemini(recovery_prompt, system_instruction="Incident recovery manager and public relations specialist.", language=language)
        result = clean_json_response(raw_recovery)
        gemini_success = True
        fallback_used = False
        fallback_type = "none"
    except Exception as e:
        print(f"[Agent 6] Recovery Gemini call failed: {e}")
        # Standard Recovery Handler fallback
        if status == "FALSE_ALARM":
            result = {
                "resolution_status": "RETRACTED",
                "public_all_clear": "CORRECTION: False alarm at G-10 Markaz. No rain flooding, water line main burst being repaired. Routes reopened.",
                "wasa_municipal_status": "Reassigned from NDMA flood squad to WASA Plumbing Division",
                "reopen_routes_animation_trigger": True,
                "recovery_lessons_logged": ["Cross check single social posts before high priority alerts"]
            }
        else:
            result = {
                "resolution_status": "RESOLVED",
                "public_all_clear": "Islamabad Crisis Orchestration updates: Situation resolved, all clear declared.",
                "wasa_municipal_status": "Handover to regional WASA monitoring teams completed.",
                "reopen_routes_animation_trigger": True,
                "recovery_lessons_logged": ["Continuous telemetry updates verified system accuracy"]
            }
        gemini_success = False
        fallback_used = True
        fallback_type = "DEFAULT_RESOLUTION"

    duration_ms = int((time.time() - start_time) * 1000)

    # final trace update, saving the final aggregated trace
    ciro_tracer.save_trace()

    ciro_logger.log(
        agent="Recovery Handler",
        action="Incident Finalization Recovery",
        mode=mode,
        location=location,
        language=language,
        data=json.dumps(result),
        thinking=result["public_all_clear"],
        decision=f"Status set to {result['resolution_status']}",
        confidence="100",
        duration_ms=duration_ms,
        gemini_success=gemini_success,
        fallback_used=fallback_used,
        fallback_type=fallback_type
    )

    return result

import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API_BASE = "http://127.0.0.1:8000";

const locationsList = [
  "G-10 Markaz",
  "F-7 Kohsar",
  "I-8 Markaz",
  "Blue Area",
  "Faizabad",
  "Islamabad Airport"
];

export default function App() {
  const [theme, setTheme] = useState('dark'); // dark / light
  const [lang, setLang] = useState('EN'); // EN / UR
  const [mode, setMode] = useState('LIVE'); // LIVE / DEMO
  
  const [selectedLoc, setSelectedLoc] = useState('G-10 Markaz');
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);

  const colors = theme === 'dark' ? {
    bg: '#040B1A',
    card: '#0A1628',
    text: '#FFFFFF',
    textSecondary: '#94A3B8',
    border: '#1E293B',
    blue: '#00D4FF',
    green: '#00FF88',
    orange: '#FF6B35'
  } : {
    bg: '#F0F4FF',
    card: '#FFFFFF',
    text: '#0A1628',
    textSecondary: '#4A5568',
    border: '#E2E8F0',
    blue: '#0066FF',
    green: '#059669',
    orange: '#EA580C'
  };

  const translations = {
    EN: {
      title: "🛡️ CIRO Guardian",
      sub: "Islamabad Sector Emergency Watcher",
      heading: "Select Islamabad Sector",
      btn: "Monitor Karo ⚡",
      alertHeader: "Emergency Dispatches Sent",
      severity: "Severity Score",
      confidence: "Confidence",
      resolved: "RESOLVED",
      active: "ACTIVE"
    },
    UR: {
      title: "🛡️ CIRO Rakhwala",
      sub: "Islamabad Sector Emergency Nigran",
      heading: "Islamabad Sector Chunein",
      btn: "Nigran Karo ⚡",
      alertHeader: "Emergency Alerts Jari",
      severity: "Severity Level",
      confidence: "Yakeen",
      resolved: "RESOLVED",
      active: "ACTIVE"
    }
  };

  const t = translations[lang];

  const triggerAnalysis = async () => {
    setLoading(true);
    setAnalysisData(null);

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: selectedLoc,
          mode: mode,
          scenario: mode === 'DEMO' ? '🌊 G-10 Urban Flood' : null,
          language: lang
        })
      });
      
      if (response.ok) {
        const res = await response.json();
        setAnalysisData(res);
      } else {
        triggerFallback();
      }
    } catch (err) {
      console.warn("Backend API down. Running Local Mobile Fallback.", err);
      triggerFallback();
    } finally {
      setLoading(false);
    }
  };

  const triggerFallback = () => {
    // Generate beautiful React Native fallback data
    setAnalysisData({
      agent2: {
        crisis_detected: true,
        crisis_type: "FLOOD",
        severity: 8,
        confidence: 85,
        reasoning: "Extreme thunderstorm precipitation registered (22mm rain)"
      },
      agent3: {
        allocation: {
          final_allocation: { ambulances: 6, police: 5, rescue: 4 }
        }
      },
      agent4: {
        PUBLIC: lang === 'EN' ? "Srinagar Highway flooded. Reroute via Kashmir Highway." : "Srinagar Highway band hai. Kashmir Highway use karein.",
        HOSPITAL: "Prepare PIMS medical wards for incoming flood injuries."
      }
    });
    Alert.alert(
      "Offline Mode",
      "Using local simulated logic indices due to server unavailability."
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* STICKY HEADER (SECTION 5) */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.blue }]}>{t.title}</Text>
        
        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={[styles.miniBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setMode(mode === 'LIVE' ? 'DEMO' : 'LIVE')}
          >
            <Text style={{ color: mode === 'LIVE' ? colors.green : colors.orange, fontWeight: 'bold', fontSize: 11 }}>
              {mode}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.miniBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setLang(lang === 'EN' ? 'UR' : 'EN')}
          >
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 11 }}>
              {lang}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.miniBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Text style={{ color: colors.text, fontSize: 12 }}>
              {theme === 'dark' ? '🌙' : '☀️'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Text style={[styles.subText, { color: colors.textSecondary }]}>{t.sub}</Text>
        
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t.heading}</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
            {locationsList.map(loc => (
              <TouchableOpacity
                key={loc}
                style={[
                  styles.locBadge, 
                  { 
                    backgroundColor: selectedLoc === loc ? colors.blue : 'rgba(255,255,255,0.05)',
                    borderColor: colors.border
                  }
                ]}
                onPress={() => setSelectedLoc(loc)}
              >
                <Text style={{ color: selectedLoc === loc ? '#000' : colors.text, fontWeight: 'bold' }}>
                  {loc}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: colors.blue }]}
            onPress={triggerAnalysis}
          >
            <Text style={styles.primaryBtnText}>{t.btn}</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <ActivityIndicator size="large" color={colors.blue} style={{ marginVertical: 30 }} />
        )}

        {/* RESULTS DISPLAYS */}
        {analysisData && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultBanner}>
              <Text style={styles.bannerTxt}>
                {analysisData.agent2.crisis_type} DETECTED
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {analysisData.agent2.reasoning}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.severity}</Text>
                <Text style={[styles.statValue, { color: colors.orange }]}>{analysisData.agent2.severity}/10</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.confidence}</Text>
                <Text style={[styles.statValue, { color: colors.blue }]}>{analysisData.agent2.confidence}%</Text>
              </View>
            </View>

            {/* RESOURCE LIST */}
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Deployments</Text>
            <View style={styles.resourceRow}>
              {Object.keys(analysisData.agent3.allocation.final_allocation).map(resKey => (
                <View key={resKey} style={[styles.miniCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, textTransform: 'capitalize' }}>{resKey}</Text>
                  <Text style={[styles.miniValue, { color: colors.blue }]}>
                    {analysisData.agent3.allocation.final_allocation[resKey]}
                  </Text>
                </View>
              ))}
            </View>

            {/* COMMUNICATIONS ALERTS */}
            <Text style={[styles.sectionHeading, { color: colors.text }]}>{t.alertHeader}</Text>
            <View style={[styles.alertBlock, { borderLeftColor: colors.orange }]}>
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>📢 Public SMS Alert</Text>
              <Text style={[styles.alertText, { color: colors.textSecondary }]}>{analysisData.agent4.PUBLIC}</Text>
            </View>

            <View style={[styles.alertBlock, { borderLeftColor: colors.blue }]}>
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>🏥 Hospital Standby Dispatch</Text>
              <Text style={[styles.alertText, { color: colors.textSecondary }]}>{analysisData.agent4.HOSPITAL}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniBtn: {
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: 20,
  },
  subText: {
    fontSize: 14,
    marginBottom: 20,
    fontWeight: 'bold',
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  locBadge: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
    marginRight: 10,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 15,
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },
  resultBanner: {
    marginBottom: 15,
  },
  bannerTxt: {
    color: '#FF3B3B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 5,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
  },
  resourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  miniCard: {
    flex: 1,
    minWidth: 80,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  miniValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 3,
  },
  alertBlock: {
    borderLeftWidth: 4,
    paddingLeft: 10,
    marginVertical: 8,
  },
  alertText: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  }
});

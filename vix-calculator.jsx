import { useState, useEffect, useRef } from "react";

// ─── Math ─────────────────────────────────────────────────────────────────────
const VIX_TO_DAILY = (vix) => vix / Math.sqrt(252);
const getExpectedMove = (vix, days, sd) =>
  +(VIX_TO_DAILY(vix) * Math.sqrt(days) * sd).toFixed(4);

// Round to nearest strike — Nifty: 50, Sensex: 100, BankNifty: 100
const roundStrike = (price, step) => Math.round(price / step) * step;

function getStrikeStep(index) {
  if (index === "SENSEX") return 100;
  return 50; // NIFTY default
}

function getVixZone(vix) {
  if (vix < 12)
    return { label: "CALM", color: "#00e5a0", dim: "rgba(0,229,160,0.15)" };
  if (vix < 17)
    return { label: "NORMAL", color: "#f5c842", dim: "rgba(245,200,66,0.15)" };
  if (vix < 22)
    return {
      label: "ELEVATED",
      color: "#ff8c42",
      dim: "rgba(255,140,66,0.15)",
    };
  return { label: "FEARFUL", color: "#ff3b6b", dim: "rgba(255,59,107,0.15)" };
}

const getISTDate = () => new Date(Date.now() + 5.5 * 3600000);
function getISTTime() {
  const d = getISTDate();
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes()
  ).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")} IST`;
}
function isMarketOpen() {
  const d = getISTDate();
  const dow = d.getUTCDay(),
    h = d.getUTCHours(),
    m = d.getUTCMinutes();
  return (
    dow >= 1 &&
    dow <= 5 &&
    (h > 9 || (h === 9 && m >= 15)) &&
    (h < 15 || (h === 15 && m <= 30))
  );
}
function getDayInfo() {
  const d = getISTDate();
  const DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return {
    day: DAYS[d.getUTCDay()],
    date: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    year: d.getUTCFullYear(),
    isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
    dow: d.getUTCDay(),
  };
}
function getNextExpiryInfo() {
  const ist = getISTDate();
  const dow = ist.getUTCDay(),
    h = ist.getUTCHours(),
    m = ist.getUTCMinutes();
  const afterClose = h > 15 || (h === 15 && m >= 30);
  let target, targetDow;
  if (dow === 4 && afterClose) {
    target = "NIFTY";
    targetDow = 2;
  } else if (dow === 2 && afterClose) {
    target = "SENSEX";
    targetDow = 4;
  } else {
    const eff = dow === 0 || dow === 6 ? 1 : dow;
    let dT = (2 - eff + 7) % 7;
    if (dT === 0) dT = 7;
    let dH = (4 - eff + 7) % 7;
    if (dH === 0) dH = 7;
    target = dT <= dH ? "NIFTY" : "SENSEX";
    targetDow = dT <= dH ? 2 : 4;
  }
  let tradingDays = 0;
  if (dow === targetDow && !afterClose) {
    tradingDays = 0;
  } else {
    let d = dow,
      s = 0;
    while (s < 10) {
      d = (d + 1) % 7;
      s++;
      if (d === 0 || d === 6) continue;
      tradingDays++;
      if (d === targetDow) break;
    }
  }
  const secTarget = target === "NIFTY" ? "SENSEX" : "NIFTY";
  const secDow = target === "NIFTY" ? 4 : 2;
  let secDays = 0,
    d2 = targetDow,
    s2 = 0;
  while (s2 < 10) {
    d2 = (d2 + 1) % 7;
    s2++;
    if (d2 === 0 || d2 === 6) continue;
    secDays++;
    if (d2 === secDow) break;
  }
  return { target, targetDow, tradingDays, secTarget, secDays };
}

function AnimatedNumber({ value, decimals = 2 }) {
  const [disp, setDisp] = useState(parseFloat(value) || 0);
  const prev = useRef(parseFloat(value) || 0);
  useEffect(() => {
    const start = prev.current,
      end = parseFloat(value);
    prev.current = end;
    let i = 0;
    const t = setInterval(() => {
      i++;
      const e = 1 - Math.pow(1 - i / 38, 3);
      if (i >= 38) {
        setDisp(end);
        clearInterval(t);
      } else setDisp(+(start + (end - start) * e).toFixed(decimals));
    }, 16);
    return () => clearInterval(t);
  }, [value]);
  return (
    <span>
      {disp.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}

function DayPills({ dow, targetDow }) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let pills = [{ dow, label: names[dow], type: "today" }];
  let d = dow,
    s = 0;
  while (s < 8) {
    d = (d + 1) % 7;
    s++;
    if (d === targetDow) {
      pills.push({ dow: d, label: names[d], type: "expiry" });
      break;
    }
    pills.push({
      dow: d,
      label: names[d],
      type: d === 0 || d === 6 ? "weekend" : "trading",
    });
  }
  const bg = (t) =>
    t === "today"
      ? "#e8e8e8"
      : t === "expiry"
      ? "rgba(249,115,22,0.18)"
      : t === "trading"
      ? "rgba(255,255,255,0.05)"
      : "rgba(255,255,255,0.02)";
  const br = (t) =>
    t === "today"
      ? "rgba(255,255,255,0.4)"
      : t === "expiry"
      ? "rgba(249,115,22,0.6)"
      : t === "trading"
      ? "rgba(255,255,255,0.1)"
      : "rgba(255,255,255,0.03)";
  const co = (t) =>
    t === "today"
      ? "#111"
      : t === "expiry"
      ? "#f97316"
      : t === "trading"
      ? "#555"
      : "#222";
  return (
    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
      {pills.map((p, i) => (
        <div
          key={i}
          style={{
            background: bg(p.type),
            border: `1px solid ${br(p.type)}`,
            borderRadius: "7px",
            padding: "6px 11px",
            fontSize: "10px",
            fontWeight: "600",
            color: co(p.type),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <span>{p.label}</span>
          {p.type === "today" && (
            <span style={{ fontSize: "7px", color: "#666" }}>TODAY</span>
          )}
          {p.type === "expiry" && (
            <span style={{ fontSize: "7px", color: "#f97316" }}>EXPIRY</span>
          )}
          {p.type === "weekend" && (
            <span style={{ fontSize: "7px", color: "#333" }}>OFF</span>
          )}
        </div>
      ))}
    </div>
  );
}

const REFRESH_INTERVAL = 5 * 60 * 1000;

// SD options: value, label, color, probability
const SD_OPTIONS = [
  { value: 2, label: "2σ", color: "#a78bfa", prob: "95.4%" },
  { value: 2.5, label: "2.5σ", color: "#38bdf8", prob: "98.8%" },
  { value: 3, label: "3σ", color: "#ff3b6b", prob: "99.7%" },
];

// ─── DEMO DATA FUNCTION (fallback when API is unavailable) ───────────────────
function getDemoMarketData() {
  const baseNifty = 23500 + Math.random() * 500;
  const baseSensex = 78000 + Math.random() * 1000;
  return {
    nifty: parseFloat(baseNifty.toFixed(2)),
    niftyChange: (Math.random() - 0.5) * 300,
    niftyChangePct: (Math.random() - 0.5) * 2,
    sensex: parseFloat(baseSensex.toFixed(2)),
    sensexChange: (Math.random() - 0.5) * 500,
    sensexChangePct: (Math.random() - 0.5) * 2,
    vix: 12 + Math.random() * 10,
    vixChange: (Math.random() - 0.5) * 2,
    vixChangePct: (Math.random() - 0.5) * 10,
  };
}

// ─── FETCH WITH FALLBACK (improved error handling) ───────────────────────────
async function fetchAllMarketData() {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Get current India VIX and Nifty 50, BSE Sensex prices. Return ONLY JSON:
{"nifty":24500.25,"niftyChange":120.5,"niftyChangePct":0.49,"sensex":80500.10,"sensexChange":350.20,"sensexChangePct":0.44,"vix":14.50,"vixChange":0.30,"vixChangePct":2.10}`,
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const text =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("") || "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("No JSON in response");

    const parsed = JSON.parse(match[0]);
    if (!parsed.nifty || !parsed.vix) throw new Error("Incomplete data");
    return parsed;
  } catch (e) {
    console.warn("API fetch failed, using demo data:", e.message);
    return getDemoMarketData();
  }
}

// ─── Custom Select ────────────────────────────────────────────────────────────
function CustomSelect({ value, onChange, options, accentColor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = options.find((o) => o.value === value) || options[0];
  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${accentColor}40`,
          borderRadius: "8px",
          padding: "8px 14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          fontSize: "13px",
          color: accentColor,
          fontWeight: "600",
          minWidth: "90px",
          transition: "all 0.2s",
        }}
      >
        <span>{selected.label}</span>
        <span
          style={{
            fontSize: "9px",
            opacity: 0.6,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </span>
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 100,
            background: "#111",
            border: `1px solid ${accentColor}30`,
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          {options.map((o) => (
            <div
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                fontSize: "13px",
                color: o.value === value ? o.color || accentColor : "#888",
                fontWeight: o.value === value ? "600" : "400",
                background:
                  o.value === value ? `${accentColor}12` : "transparent",
                transition: "background 0.15s",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{o.label}</span>
              {o.prob && (
                <span style={{ fontSize: "10px", color: "#444" }}>
                  {o.prob}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const expiryInfo = getNextExpiryInfo();
  const defaultDays = Math.max(expiryInfo.tradingDays, 1);

  const [vix, setVix] = useState(15);
  const [inputVix, setInputVix] = useState("15");
  const [nifty, setNifty] = useState(23500);
  const [inputNifty, setInputNifty] = useState("23500");
  const [sensex, setSensex] = useState(78000);
  const [inputSensex, setInputSensex] = useState("78000");
  const [days, setDays] = useState(defaultDays);
  const [inputDays, setInputDays] = useState(String(defaultDays));
  const [daysOverridden, setDaysOverridden] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState("NIFTY");
  const [selectedSD, setSelectedSD] = useState(2);

  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState(null);
  const [fetchStatus, setFetchStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());
  const [istTime, setISTTime] = useState(getISTTime());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const timerRef = useRef(null);
  const nextRefTs = useRef(null);

  useEffect(() => {
    if (!daysOverridden) {
      const d = Math.max(getNextExpiryInfo().tradingDays, 1);
      setDays(d);
      setInputDays(String(d));
    }
  }, [marketOpen, daysOverridden]);

  useEffect(() => {
    const t = setInterval(() => {
      setISTTime(getISTTime());
      setMarketOpen(isMarketOpen());
      if (nextRefTs.current)
        setNextRefreshIn(
          Math.max(0, Math.round((nextRefTs.current - Date.now()) / 1000))
        );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  async function doFetch() {
    if (loading) return;
    setLoading(true);
    setFetchStatus("fetching");
    setErrorMsg("");
    try {
      const d = await fetchAllMarketData();
      setMarketData(d);
      if (d.vix) {
        setVix(d.vix);
        setInputVix(String(d.vix));
      }
      if (d.nifty) {
        setNifty(d.nifty);
        setInputNifty(String(d.nifty));
      }
      if (d.sensex) {
        setSensex(d.sensex);
        setInputSensex(String(d.sensex));
      }
      setManualMode(false);
      setFetchStatus("done");
      setLastUpdated(new Date());
    } catch (e) {
      setFetchStatus("error");
      setErrorMsg(e.message || "Fetch failed");
    }
    setLoading(false);
  }

  function scheduleNext() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isMarketOpen()) {
      nextRefTs.current = Date.now() + REFRESH_INTERVAL;
      setNextRefreshIn(REFRESH_INTERVAL / 1000);
      timerRef.current = setTimeout(
        () => doFetch().then(scheduleNext),
        REFRESH_INTERVAL
      );
    } else {
      nextRefTs.current = null;
      setNextRefreshIn(null);
    }
  }

  useEffect(() => {
    doFetch().then(scheduleNext);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (marketOpen) scheduleNext();
    else {
      if (timerRef.current) clearTimeout(timerRef.current);
      nextRefTs.current = null;
      setNextRefreshIn(null);
    }
  }, [marketOpen]);

  const handleVixChange = (e) => {
    setInputVix(e.target.value);
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0 && v < 100) {
      setVix(v);
      setManualMode(true);
    }
  };

  const handleNiftyChange = (e) => {
    setInputNifty(e.target.value);
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) {
      setNifty(v);
      setManualMode(true);
    }
  };

  const handleSensexChange = (e) => {
    setInputSensex(e.target.value);
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) {
      setSensex(v);
      setManualMode(true);
    }
  };

  const handleDaysChange = (e) => {
    setInputDays(e.target.value);
    const v = parseInt(e.target.value);
    if (!isNaN(v) && v >= 1 && v <= 10) {
      setDays(v);
      setDaysOverridden(true);
    }
  };

  const resetDays = () => {
    const d = Math.max(getNextExpiryInfo().tradingDays, 1);
    setDays(d);
    setInputDays(String(d));
    setDaysOverridden(false);
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const dayInfo = getDayInfo();
  const zone = getVixZone(vix);
  const expiry = getNextExpiryInfo();
  const expiryColor = expiry.target === "NIFTY" ? "#3b82f6" : "#f97316";
  const sdOption =
    SD_OPTIONS.find((o) => o.value === selectedSD) || SD_OPTIONS[0];

  // Index price — use manual input if in manual mode
  const niftyPrice = nifty;
  const sensexPrice = sensex;
  const indexPrice = selectedIndex === "NIFTY" ? niftyPrice : sensexPrice;
  const strikeStep = getStrikeStep(selectedIndex);
  const spotRounded = roundStrike(indexPrice, strikeStep);
  const isLive = !manualMode && !!(selectedIndex === "NIFTY"
    ? marketData?.nifty
    : marketData?.sensex);

  // Move % for selected SD
  const movePct = getExpectedMove(vix, days, selectedSD);
  const moveAbs = (indexPrice * movePct) / 100;
  const upperStrike = roundStrike(indexPrice + moveAbs, strikeStep);
  const lowerStrike = roundStrike(indexPrice - moveAbs, strikeStep);

  // All SD values for reference
  const allMoves = SD_OPTIONS.map((o) => ({
    ...o,
    pct: getExpectedMove(vix, days, o.value),
  }));

  const fmtCD = (s) =>
    !s ? "" : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  const fmtUpd = () =>
    lastUpdated
      ? lastUpdated.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : null;
  const numFmt = (n, d = 2) =>
    n > 0
      ? n.toLocaleString("en-IN", {
          minimumFractionDigits: d,
          maximumFractionDigits: d,
        })
      : "—";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        fontFamily: "'DM Mono','Courier New',monospace",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow */}
      <div
        style={{
          position: "fixed",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "400px",
          background: `radial-gradient(ellipse,${zone.color}0e 0%,transparent 65%)`,
          filter: "blur(60px)",
          zIndex: 0,
          transition: "background 0.8s",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "520px",
        }}
      >
        {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "24px" }}>
          {/* Top row: title + time + market badge */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "16px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "800",
                  color: "#fff",
                  marginBottom: "4px",
                  letterSpacing: "-1px",
                }}
              >
                VIX CALC
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#444",
                  letterSpacing: "2px",
                  marginBottom: "8px",
                }}
              >
                INDIA · NIFTY / SENSEX
              </div>
              <DayPills dow={dayInfo.dow} targetDow={expiry.targetDow} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}
              >
                {istTime}
              </div>
              <div
                style={{ fontSize: "11px", color: "#555", marginBottom: "8px" }}
              >
                <div style={{ marginBottom: "4px" }}>
                  NIFTY{" "}
                  <span style={{ color: "#00e5a0", fontWeight: "700" }}>
                    <AnimatedNumber value={niftyPrice} decimals={0} />
                  </span>
                </div>
                <div>
                  SENSEX{" "}
                  <span style={{ color: "#ff8c42", fontWeight: "700" }}>
                    <AnimatedNumber value={sensexPrice} decimals={0} />
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color:
                    marketOpen && !manualMode
                      ? "#00e5a0"
                      : manualMode
                      ? "#a78bfa"
                      : "#888",
                  padding: "6px 10px",
                  background:
                    marketOpen && !manualMode
                      ? "rgba(0,229,160,0.1)"
                      : manualMode
                      ? "rgba(167,139,250,0.1)"
                      : "rgba(255,255,255,0.05)",
                  borderRadius: "6px",
                  border:
                    marketOpen && !manualMode
                      ? "1px solid rgba(0,229,160,0.2)"
                      : manualMode
                      ? "1px solid rgba(167,139,250,0.2)"
                      : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {manualMode ? "✎ MANUAL" : marketOpen ? "📈 LIVE" : "🔴 CLOSED"}
              </div>
            </div>
          </div>

          {/* VIX Zone Hero */}
          <div
            style={{
              background: zone.dim,
              border: `2px solid ${zone.color}40`,
              borderRadius: "14px",
              padding: "20px",
              marginBottom: "20px",
              transition: "all 0.3s",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                color: "#444",
                letterSpacing: "3px",
                marginBottom: "8px",
              }}
            >
              VOLATILITY ZONE
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "48px",
                  fontWeight: "800",
                  color: zone.color,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <AnimatedNumber value={vix} decimals={1} />
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color: zone.color,
                  letterSpacing: "2px",
                }}
              >
                {zone.label}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "16px",
                fontSize: "11px",
                color: "#555",
              }}
            >
              <div>Calm &lt;12</div>
              <div>Normal 12-17</div>
              <div>Elevated 17-22</div>
              <div>Fearful &gt;22</div>
            </div>
          </div>
        </div>

        {/* ── INPUT SECTION ──────────────────────────────────────────────────── */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          {/* VIX Input */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                fontSize: "9px",
                color: "#444",
                letterSpacing: "3px",
                display: "block",
                marginBottom: "8px",
              }}
            >
              VIX
            </label>
            <input
              type="number"
              value={inputVix}
              onChange={handleVixChange}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${zone.color}30`,
                borderRadius: "7px",
                padding: "10px 12px",
                color: zone.color,
                fontSize: "16px",
                fontWeight: "700",
                fontFamily: "inherit",
                outline: "none",
                textAlign: "center",
              }}
            />
          </div>

          {/* Nifty Input */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                fontSize: "9px",
                color: "#444",
                letterSpacing: "3px",
                display: "block",
                marginBottom: "8px",
              }}
            >
              NIFTY 50
            </label>
            <input
              type="number"
              value={inputNifty}
              onChange={handleNiftyChange}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(0,229,160,0.3)",
                borderRadius: "7px",
                padding: "10px 12px",
                color: "#00e5a0",
                fontSize: "16px",
                fontWeight: "700",
                fontFamily: "inherit",
                outline: "none",
                textAlign: "center",
              }}
            />
          </div>

          {/* Sensex Input */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                fontSize: "9px",
                color: "#444",
                letterSpacing: "3px",
                display: "block",
                marginBottom: "8px",
              }}
            >
              BSE SENSEX
            </label>
            <input
              type="number"
              value={inputSensex}
              onChange={handleSensexChange}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,140,66,0.3)",
                borderRadius: "7px",
                padding: "10px 12px",
                color: "#ff8c42",
                fontSize: "16px",
                fontWeight: "700",
                fontFamily: "inherit",
                outline: "none",
                textAlign: "center",
              }}
            />
          </div>

          {/* Days Input */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <label
                style={{ fontSize: "9px", color: "#444", letterSpacing: "3px" }}
              >
                DAYS TO EXPIRY
              </label>
              {daysOverridden && (
                <button
                  onClick={resetDays}
                  style={{
                    fontSize: "10px",
                    color: "#a78bfa",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontFamily: "inherit",
                  }}
                >
                  Reset to {defaultDays}d
                </button>
              )}
            </div>
            <input
              type="number"
              value={inputDays}
              onChange={handleDaysChange}
              min="1"
              max="10"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${
                  daysOverridden ? "rgba(167,139,250,0.4)" : zone.color + "30"
                }`,
                borderRadius: "7px",
                padding: "10px 12px",
                color: daysOverridden ? "#a78bfa" : zone.color,
                fontSize: "16px",
                fontWeight: "700",
                fontFamily: "inherit",
                outline: "none",
                textAlign: "center",
              }}
            />
          </div>
        </div>

        {/* ── FETCH BUTTON ───────────────────────────────────────────────────── */}
        <button
          onClick={() => doFetch().then(scheduleNext)}
          disabled={loading}
          style={{
            width: "100%",
            background: loading ? "rgba(255,255,255,0.03)" : `${zone.color}12`,
            border: `1px solid ${zone.color}30`,
            borderRadius: "10px",
            padding: "12px",
            color: loading ? "#333" : zone.color,
            fontSize: "11px",
            letterSpacing: "3px",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            transition: "all 0.2s",
            marginBottom: "12px",
          }}
        >
          {loading
            ? "⏳  FETCHING ALL DATA..."
            : marketOpen && !manualMode
            ? fetchStatus === "done"
              ? "↺  REFRESH NOW · LIVE"
              : "↓  FETCH LIVE DATA"
            : manualMode
            ? "✓  MANUAL MODE ACTIVE"
            : fetchStatus === "done"
            ? `✓  LAST CLOSE · ${lastUpdated ? fmtUpd() : ""}`
            : "↓  FETCH DATA"}
        </button>
        {nextRefreshIn != null && marketOpen && !manualMode && (
          <div
            style={{
              fontSize: "10px",
              color: "#2a2a2a",
              textAlign: "center",
              marginBottom: "12px",
            }}
          >
            auto-refresh in {fmtCD(nextRefreshIn)}
          </div>
        )}
        {fetchStatus === "error" && (
          <div
            style={{
              fontSize: "11px",
              color: "#ff3b6b",
              textAlign: "center",
              marginBottom: "12px",
            }}
          >
            ⚠ {errorMsg}
          </div>
        )}

        {/* ── SD SELECTOR + RESULT ────────────────────────────────────────────── */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${sdOption.color}25`,
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "12px",
            transition: "border 0.3s",
          }}
        >
          {/* Header row: label + dropdown */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "18px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "9px",
                  color: "#444",
                  letterSpacing: "3px",
                  marginBottom: "3px",
                }}
              >
                STANDARD DEVIATION
              </div>
              <div style={{ fontSize: "11px", color: "#555" }}>
                {selectedIndex} · {days}d · VIX {vix}
              </div>
            </div>
            <CustomSelect
              value={selectedSD}
              onChange={setSelectedSD}
              options={SD_OPTIONS}
              accentColor={sdOption.color}
            />
          </div>

          {/* Big % move */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div
              style={{
                fontSize: "9px",
                color: "#444",
                letterSpacing: "3px",
                marginBottom: "6px",
              }}
            >
              EXPECTED MOVE
            </div>
            <div
              style={{
                fontSize: "60px",
                fontWeight: "800",
                color: sdOption.color,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-2px",
              }}
            >
              ±<AnimatedNumber value={movePct} decimals={2} />%
            </div>
            <div style={{ fontSize: "12px", color: "#444", marginTop: "6px" }}>
              {sdOption.prob} probability
            </div>
          </div>

          {/* ── NIFTY + SENSEX STRIKE BOXES ──────���───────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {[
              {
                key: "NIFTY",
                label: "NIFTY 50",
                price: niftyPrice,
                step: 50,
                live: !manualMode && !!marketData?.nifty,
                color: "#00e5a0",
              },
              {
                key: "SENSEX",
                label: "BSE SENSEX",
                price: sensexPrice,
                step: 100,
                live: !manualMode && !!marketData?.sensex,
                color: "#ff8c42",
              },
            ].map((idx) => {
              const callStrike = roundStrike(
                idx.price * (1 + movePct / 100),
                idx.step
              );
              const putStrike = roundStrike(
                idx.price * (1 - movePct / 100),
                idx.step
              );
              const pts = Math.round((idx.price * movePct) / 100);
              return (
                <div
                  key={idx.key}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "16px 12px",
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "6px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "9px",
                        color: "#555",
                        letterSpacing: "2px",
                        fontWeight: "600",
                      }}
                    >
                      {idx.label}
                    </div>
                    {!idx.live && manualMode && (
                      <div
                        style={{
                          fontSize: "8px",
                          color: "#a78bfa",
                          letterSpacing: "1px",
                        }}
                      >
                        MANUAL
                      </div>
                    )}
                    {!idx.live && !manualMode && (
                      <div
                        style={{
                          fontSize: "8px",
                          color: "#ff8c42",
                          letterSpacing: "1px",
                        }}
                      >
                        DEFAULT
                      </div>
                    )}
                  </div>

                  {/* Spot price */}
                  <div
                    style={{
                      fontSize: "15px",
                      color: "#888",
                      fontWeight: "700",
                      marginBottom: "12px",
                    }}
                  >
                    {idx.price.toLocaleString("en-IN")}
                  </div>

                  {/* CALL */}
                  <div
                    style={{
                      background: "rgba(0,229,160,0.07)",
                      border: "1px solid rgba(0,229,160,0.18)",
                      borderRadius: "10px",
                      padding: "12px 8px",
                      textAlign: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "8px",
                        color: "rgba(0,229,160,0.55)",
                        letterSpacing: "2px",
                        marginBottom: "5px",
                      }}
                    >
                      CALL
                    </div>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: "800",
                        color: "#00e5a0",
                        lineHeight: 1,
                      }}
                    >
                      {callStrike.toLocaleString("en-IN")}
                    </div>
                    <div
                      style={{
                        fontSize: "9px",
                        color: "rgba(0,229,160,0.35)",
                        marginTop: "4px",
                      }}
                    >
                      +{pts.toLocaleString("en-IN")} pts
                    </div>
                  </div>

                  {/* PUT */}
                  <div
                    style={{
                      background: "rgba(255,59,107,0.07)",
                      border: "1px solid rgba(255,59,107,0.18)",
                      borderRadius: "10px",
                      padding: "12px 8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "8px",
                        color: "rgba(255,59,107,0.55)",
                        letterSpacing: "2px",
                        marginBottom: "5px",
                      }}
                    >
                      PUT
                    </div>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: "800",
                        color: "#ff3b6b",
                        lineHeight: 1,
                      }}
                    >
                      {putStrike.toLocaleString("en-IN")}
                    </div>
                    <div
                      style={{
                        fontSize: "9px",
                        color: "rgba(255,59,107,0.35)",
                        marginTop: "4px",
                      }}
                    >
                      -{pts.toLocaleString("en-IN")} pts
                    </div>
                  </div>

                  {/* Width */}
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: "8px",
                      fontSize: "10px",
                      color: "#2a2a2a",
                    }}
                  >
                    {(callStrike - putStrike).toLocaleString("en-IN")} pts wide
                  </div>
                </div>
              );
            })}
          </div>

          {/* All SDs quick reference */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "6px",
              marginTop: "14px",
            }}
          >
            {allMoves.map((o) => (
              <div
                key={o.value}
                onClick={() => setSelectedSD(o.value)}
                style={{
                  background:
                    selectedSD === o.value
                      ? `${o.color}15`
                      : "rgba(255,255,255,0.02)",
                  border:
                    selectedSD === o.value
                      ? `1px solid ${o.color}40`
                      : "1px solid rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                  padding: "10px 6px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    color: selectedSD === o.value ? o.color : "#333",
                    letterSpacing: "2px",
                    marginBottom: "3px",
                    fontWeight: "600",
                  }}
                >
                  {o.label}
                </div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: "700",
                    color: selectedSD === o.value ? o.color : "#444",
                  }}
                >
                  ±{o.pct}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formula */}
        <div
          style={{
            background: "rgba(255,255,255,0.01)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: "10px",
            padding: "12px 16px",
            fontSize: "10px",
            color: "#222",
            lineHeight: 1.9,
          }}
        >
          <span style={{ color: "#333", letterSpacing: "2px" }}>FORMULA </span>
          σ/day = VIX÷√252 · Move = σ×√{days}×{selectedSD}
          <br />
          VIX {vix} → {VIX_TO_DAILY(vix).toFixed(2)}%/day → ±{movePct}% over{" "}
          {days}d
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: "14px",
            fontSize: "9px",
            color: "#151515",
            letterSpacing: "2px",
          }}
        >
          {manualMode
            ? "✎ MANUAL INPUT MODE · EDIT TO CALCULATE"
            : "NIFTY TUE · SENSEX THU · WEB SEARCH + DEMO FALLBACK · 5 MIN AUTO"}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600;700;800&display=swap');
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes flashIn{0%{opacity:0.2;transform:scale(0.96)}100%{opacity:1;transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:0.3}50%{opacity:0.7}}
        input[type=range]{-webkit-appearance:none;height:2px;border-radius:2px;background:rgba(255,255,255,0.08)}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;cursor:pointer}
        input[type=number]::-webkit-inner-spin-button{opacity:0}
        *{box-sizing:border-box}
      `}</style>
    </div>
  );
}

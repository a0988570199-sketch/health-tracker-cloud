import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase 設定 ────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://puaqztqlujcuwgxpexht.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VGBv-lhpcGw3Ka3s5h-9sA_F37nCtj7";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  }
});

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const DAILY_GOALS = { calories: 2000, protein: 60, carbs: 250, fat: 65, fiber: 25 };

const C = {
  bg: "#FAFAF7",        // 砂白底色
  card: "#F0EEE8",      // 卡片
  cardInner: "#E8E5DC", // 卡片內層
  accent: "#7A8C6E",    // 鼠尾草綠（主強調色）
  accentLight: "#EAF0E6",
  accent2: "#C4A882",   // 暖棕（次強調）
  accent2Light: "#F5EDE0",
  green: "#7A8C6E",
  blue: "#6B8FA8",
  yellow: "#C4A882",
  purple: "#9E8AAA",
  text: "#28231E",
  textMuted: "#888780",
  textSub: "#A09890",
  border: "#E4E2DA",
  borderStrong: "#D0CCC2",
};

const todayKey = () => new Date().toISOString().split("T")[0];
const fmtShort = (d) => new Date(d + "T00:00:00").toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
const fmtLong = (d) => new Date(d + "T00:00:00").toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

// ─── Supabase 資料存取 ─────────────────────────────────────────────────────────
async function dbGet(userId, key) {
  const { data } = await supabase
    .from("health_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .single();
  return data ? data.value : null;
}

async function dbSet(userId, key, value) {
  await supabase.from("health_data").upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );
}

// ─── Supabase useData hook ────────────────────────────────────────────────────
function useData(userId, key, init) {
  const [val, setVal] = useState(init);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) return;
    dbGet(userId, key).then(v => {
      if (v !== null) setVal(v);
      setReady(true);
    }).catch(() => setReady(true));
  }, [userId, key]);

  const set = (updater) => {
    setVal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      dbSet(userId, key, next).catch(console.error);
      return next;
    });
  };

  return [val, set, ready];
}

// ─── 小元件 ───────────────────────────────────────────────────────────────────
const Ring = ({ value, max, color, size = 64 }) => {
  const r = 24, cx = 32, cy = 32, stroke = 5;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
};

const NutriBar = ({ label, current, goal, color, unit = "g" }) => {
  const pct = Math.min((current / goal) * 100, 100);
  const remaining = Math.max(goal - current, 0);
  const over = current > goal;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
        <span style={{ fontWeight: 500, color: C.text }}>{label}</span>
        <span style={{ color: over ? C.accent : C.textMuted }}>
          {current}{unit} / {goal}{unit}{over ? " ⚠️" : ` (剩 ${remaining}${unit})`}
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 50, background: C.border, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 50, background: over ? C.accent : color, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
};

const WeightChart = ({ data, shotDate }) => {
  if (data.length < 2) return (
    <div style={{ textAlign: "center", color: C.textMuted, padding: "40px 0", fontSize: 13 }}>
      至少記錄 2 天才能顯示曲線圖 📈
    </div>
  );
  const W = 480, H = 190, PAD = { t: 20, r: 20, b: 36, l: 48 };
  const weights = data.map(d => d.weight);
  const minW = Math.min(...weights) - 1, maxW = Math.max(...weights) + 1;
  const sx = (i) => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r);
  const sy = (w) => PAD.t + (1 - (w - minW) / (maxW - minW)) * (H - PAD.t - PAD.b);
  const points = data.map((d, i) => `${sx(i)},${sy(d.weight)}`).join(" ");
  const area = `M${sx(0)},${sy(data[0].weight)} ` + data.slice(1).map((d, i) => `L${sx(i + 1)},${sy(d.weight)}`).join(" ") + ` L${sx(data.length - 1)},${H - PAD.b} L${sx(0)},${H - PAD.b} Z`;
  const shotIdx = shotDate ? data.findIndex(d => d.date >= shotDate) : -1;
  const step = data.length <= 7 ? 1 : data.length <= 14 ? 2 : Math.ceil(data.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = PAD.t + t * (H - PAD.t - PAD.b);
        return (
          <g key={t}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke={C.border} strokeWidth="1" strokeDasharray="4,3" />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="10" fill={C.textMuted}>{(maxW - (maxW - minW) * t).toFixed(1)}</text>
          </g>
        );
      })}
      {shotIdx >= 0 && (
        <g>
          <line x1={sx(shotIdx)} y1={PAD.t} x2={sx(shotIdx)} y2={H - PAD.b} stroke={C.accent} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.7" />
          <text x={sx(shotIdx) + 4} y={PAD.t + 10} fontSize="9" fill={C.accent} fontWeight="700">💉 開始</text>
        </g>
      )}
      {data.map((d, i) => (i % step === 0 || i === data.length - 1) && (
        <text key={i} x={sx(i)} y={H - PAD.b + 14} textAnchor="middle" fontSize="9" fill={C.textMuted}>{fmtShort(d.date)}</text>
      ))}
      <path d={area} fill="url(#wg)" />
      <polyline points={points} fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={sx(i)} cy={sy(d.weight)} r={i === shotIdx ? 6 : 4} fill={i === shotIdx ? C.accent : "white"} stroke={C.accent} strokeWidth="2" />
          {(data.length <= 10 || i === data.length - 1 || i === shotIdx) && (
            <text x={sx(i)} y={sy(d.weight) - 9} textAnchor="middle" fontSize="9" fill={C.accent} fontWeight="600">{d.weight}</text>
          )}
        </g>
      ))}
    </svg>
  );
};

// ─── 體態照片分頁 ──────────────────────────────────────────────────────────────
const PhotosTab = ({ photos, setPhotos, today }) => {
  const fileRef = useRef(null);
  const dateRef = useRef(null);
  const cameraRef = useRef(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [uploadDate, setUploadDate] = useState(today);
  const [note, setNote] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const savePhoto = () => {
    if (!previewSrc) return;
    setPhotos(prev => [...prev, { id: Date.now(), date: uploadDate, src: previewSrc, note: note.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
    setPreviewSrc(null); setNote(""); setUploadDate(today); setShowUpload(false);
    if (fileRef.current) fileRef.current.value = ""; if (cameraRef.current) cameraRef.current.value = "";
  };

  const deletePhoto = (id) => { if (window.confirm("確定刪除？")) setPhotos(prev => prev.filter(p => p.id !== id)); };
  const sorted = [...photos].sort((a, b) => b.date.localeCompare(a.date));

  const inp = { width: "100%", padding: "10px 12px", borderRadius: 6, border: `0.5px solid ${C.border}`, fontSize: 13, outline: "none", background: C.bg, color: C.text, boxSizing: "border-box" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.textSub, fontWeight: 500 }}>共 {photos.length} 張記錄</div>
        <button style={{ background: C.accent, color: "white", border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => setShowUpload(!showUpload)}>+ 上傳照片</button>
      </div>
      {showUpload && (
        <div style={{ background: C.card, borderRadius: 8, padding: 16, marginBottom: 12, border: `0.5px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>新增體態照片</div>
          {/* 日期：文字框＋透明 date input 疊上去，overflow hidden 防止跑版 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>拍攝日期</div>
            <div style={{ position: "relative", overflow: "hidden", borderRadius: 6 }}>
              <div style={{ ...inp, display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none" }}>
                <span>{new Date(uploadDate + "T00:00:00").toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })}</span>
                <span style={{ fontSize: 14, color: C.textSub }}>▾</span>
              </div>
              <input ref={dateRef} type="date" max={today} value={uploadDate}
                onChange={e => { if (e.target.value) setUploadDate(e.target.value); }}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", margin: 0 }} />
            </div>
          </div>

          {/* 選照片：拍照用 capture，相簿不加 capture 且不限 accept（iOS Safari 才會跳選擇視窗）*/}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>選擇照片</div>
            {previewSrc ? (
              <button type="button" onClick={() => { setPreviewSrc(null); if(fileRef.current) fileRef.current.value=""; if(cameraRef.current) cameraRef.current.value=""; }}
                style={{ width: "100%", padding: "10px", borderRadius: 6, border: `0.5px solid ${C.border}`, background: C.bg, fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.accent }}>
                🔄 重新選擇
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => cameraRef.current.click()}
                  style={{ flex: 1, padding: "12px 8px", borderRadius: 6, border: `0.5px solid ${C.border}`, background: C.bg, fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.text }}>
                  📷 拍照
                </button>
                <button type="button" onClick={() => fileRef.current.click()}
                  style={{ flex: 1, padding: "12px 8px", borderRadius: 6, border: `0.5px solid ${C.border}`, background: C.bg, fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.text }}>
                  🖼️ 從相簿
                </button>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
            <input ref={fileRef} type="file" onChange={handleFile} style={{ display: "none" }} />
          </div>
          {previewSrc && <div style={{ marginBottom: 10 }}><img src={previewSrc} alt="預覽" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 6 }} /></div>}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>備註（選填）</div>
            <input type="text" placeholder="例如：第 1 週、打第 2 針後..." value={note} onChange={e => setNote(e.target.value)} style={inp} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={savePhoto} disabled={!previewSrc}
              style={{ flex: 1, background: previewSrc ? C.green : C.border, color: "white", border: "none", borderRadius: 6, padding: "10px", fontSize: 13, fontWeight: 600, cursor: previewSrc ? "pointer" : "default" }}>儲存照片</button>
            <button onClick={() => { setShowUpload(false); setPreviewSrc(null); setNote(""); if (fileRef.current) fileRef.current.value = ""; }}
              style={{ background: "transparent", border: `0.5px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", fontSize: 12, fontWeight: 600, color: C.textMuted, cursor: "pointer" }}>取消</button>
          </div>
        </div>
      )}
      {photos.length === 0 && (
        <div style={{ background: C.card, borderRadius: 8, padding: 40, textAlign: "center", border: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>還沒有體態照片</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>每週上傳一張，記錄你的蛻變過程</div>
        </div>
      )}
      {sorted.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {sorted.map(p => (
            <div key={p.id} style={{ background: C.card, borderRadius: 6, overflow: "hidden", border: `0.5px solid ${C.border}`, cursor: "pointer" }} onClick={() => setSelectedPhoto(p)}>
              <img src={p.src} alt={p.note || p.date} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{fmtShort(p.date)}</div>
                {p.note && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {selectedPhoto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column" }} onClick={() => setSelectedPhoto(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }} onClick={e => e.stopPropagation()}>
            <div>
              <div style={{ color: "white", fontWeight: 600, fontSize: 15 }}>{fmtLong(selectedPhoto.date)}</div>
              {selectedPhoto.note && <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 }}>{selectedPhoto.note}</div>}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { deletePhoto(selectedPhoto.id); setSelectedPhoto(null); }} style={{ background: "rgba(255,80,50,0.3)", border: "none", borderRadius: 8, padding: "8px 14px", color: "white", fontSize: 13, cursor: "pointer" }}>🗑 刪除</button>
              <button onClick={() => setSelectedPhoto(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "8px 14px", color: "white", fontSize: 13, cursor: "pointer" }}>✕</button>
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px 32px" }}>
            <img src={selectedPhoto.src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6 }} />
          </div>
          {sorted.length > 1 && (() => {
            const idx = sorted.findIndex(p => p.id === selectedPhoto.id);
            return (
              <>
                {idx < sorted.length - 1 && <button style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 50, width: 40, height: 40, fontSize: 20, color: "white", cursor: "pointer" }} onClick={e => { e.stopPropagation(); setSelectedPhoto(sorted[idx + 1]); }}>‹</button>}
                {idx > 0 && <button style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 50, width: 40, height: 40, fontSize: 20, color: "white", cursor: "pointer" }} onClick={e => { e.stopPropagation(); setSelectedPhoto(sorted[idx - 1]); }}>›</button>}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

// ─── 登入畫面（密碼登入）─────────────────────────────────────────────────────
const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 6, border: `0.5px solid ${C.borderStrong}`, fontSize: 14, outline: "none", background: C.card, color: C.text, boxSizing: "border-box", marginBottom: 10, fontFamily: "inherit" };

  const handleSubmit = async () => {
    if (!email.includes("@")) { setError("請輸入有效的 Email"); return; }
    if (password.length < 6) { setError("密碼至少需要 6 個字元"); return; }
    setLoading(true); setError("");
    if (isSignUp) {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) setError(err.message === "User already registered" ? "此 Email 已註冊，請直接登入" : err.message);
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message === "Invalid login credentials" ? "Email 或密碼錯誤" : err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans TC', sans-serif", padding: "0 28px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 40, marginBottom: 16 }}>🌿</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>Health Journal</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: C.text, marginBottom: 6 }}>健康日記</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 36, textAlign: "center", lineHeight: 1.7 }}>登入後，所有裝置都能同步你的資料</div>

      <div style={{ width: "100%", maxWidth: 340 }}>
        {/* 切換登入 / 註冊 */}
        <div style={{ display: "flex", background: C.card, borderRadius: 6, padding: 3, marginBottom: 20, border: `0.5px solid ${C.border}` }}>
          {[["login", "登入"], ["signup", "註冊新帳號"]].map(([key, label]) => (
            <button key={key} onClick={() => { setIsSignUp(key === "signup"); setError(""); }}
              style={{ flex: 1, padding: "8px", borderRadius: 4, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                background: (key === "signup") === isSignUp ? C.accent : "transparent",
                color: (key === "signup") === isSignUp ? "white" : C.textMuted }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 600, color: C.textSub, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 6 }}>Email</div>
        <input type="email" placeholder="your@email.com" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          style={inputStyle} />

        <div style={{ fontSize: 10, fontWeight: 600, color: C.textSub, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 6 }}>密碼</div>
        <input type="password" placeholder={isSignUp ? "設定密碼（至少 6 個字元）" : "輸入密碼"} value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          style={inputStyle} />

        {error && <div style={{ fontSize: 12, color: "#C47A5A", marginBottom: 10, padding: "8px 10px", background: "#FAF0EC", borderRadius: 6 }}>{error}</div>}

        <button onClick={handleSubmit} disabled={loading}
          style={{ width: "100%", background: C.accent, color: "white", border: "none", borderRadius: 6, padding: "13px", fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, letterSpacing: "0.3px", fontFamily: "inherit" }}>
          {loading ? "處理中⋯" : isSignUp ? "建立帳號" : "登入"}
        </button>

        <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 14, lineHeight: 1.8 }}>
          {isSignUp ? "已有帳號？" : "還沒有帳號？"}
          <span onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            style={{ color: C.accent, fontWeight: 600, cursor: "pointer", marginLeft: 4 }}>
            {isSignUp ? "直接登入" : "立即註冊"}
          </span>
        </div>
      </div>
      )}
    </div>
  );
};

// ─── 主 App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Handle magic link redirect — parse token from URL if present
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setAuthLoading(false);
      // Clean up URL after magic link login
      if (event === "SIGNED_IN" && window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans TC', sans-serif", gap: 14 }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 36 }}>🌿</div>
      <div style={{ fontSize: 13, color: C.textMuted }}>載入中⋯</div>
    </div>
  );

  if (!session) return <LoginScreen />;
  return <MainApp userId={session.user.id} userEmail={session.user.email} />;
}

// ─── 主畫面（需登入） ──────────────────────────────────────────────────────────
function MainApp({ userId, userEmail }) {
  const [tab, setTab] = useState("today");
  const [weightHistory, setWeightHistory, readyWH] = useData(userId, "wh_v2", []);
  const [foodLog, setFoodLog, readyFL] = useData(userId, "fl_v2", {});
  const [goals, setGoals, readyGoals] = useData(userId, "goals_v2", DAILY_GOALS);
  const [photos, setPhotos, readyPhotos] = useData(userId, "photos_v1", []);
  const [shotDate, setShotDate] = useData(userId, "shot_date_v1", "2026-04-30");
  const [shotLabel, setShotLabel] = useData(userId, "shot_label_v1", "瘦瘦針開始日");

  const isLoading = !readyWH || !readyFL || !readyGoals || !readyPhotos;

  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [editingShotDate, setEditingShotDate] = useState(false);
  const [shotDateInput, setShotDateInput] = useState("");
  const [editingShotLabel, setEditingShotLabel] = useState(false);
  const [shotLabelInput, setShotLabelInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [foodForm, setFoodForm] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "" });
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [goalsForm, setGoalsForm] = useState(DAILY_GOALS);

  useEffect(() => { if (readyGoals) setGoalsForm(goals); }, [readyGoals]);

  const today = todayKey();
  const isToday = selectedDate === today;
  const selectedFoods = (foodLog[selectedDate] || []);
  const selectedTotals = selectedFoods.reduce((acc, f) => ({
    calories: acc.calories + (f.calories || 0), protein: acc.protein + (f.protein || 0),
    carbs: acc.carbs + (f.carbs || 0), fat: acc.fat + (f.fat || 0), fiber: acc.fiber + (f.fiber || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const calRemaining = goals.calories - selectedTotals.calories;
  const selectedWeight = weightHistory.find(w => w.date === selectedDate);

  const shiftDate = (days) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    const next = d.toISOString().split("T")[0];
    if (next <= today) { setSelectedDate(next); setShowWeightInput(false); setShowFoodForm(false); }
  };

  const addWeight = () => {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w < 20 || w > 300) return;
    setWeightHistory(prev => [...prev.filter(h => h.date !== selectedDate), { date: selectedDate, weight: w }].sort((a, b) => a.date.localeCompare(b.date)));
    setWeightInput(""); setShowWeightInput(false);
  };

  const addFood = () => {
    const f = { id: Date.now(), name: foodForm.name || "未命名食物", calories: parseFloat(foodForm.calories) || 0, protein: parseFloat(foodForm.protein) || 0, carbs: parseFloat(foodForm.carbs) || 0, fat: parseFloat(foodForm.fat) || 0, fiber: parseFloat(foodForm.fiber) || 0 };
    setFoodLog(prev => ({ ...prev, [selectedDate]: [...(prev[selectedDate] || []), f] }));
    setFoodForm({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "" });
    setShowFoodForm(false);
  };

  const S = {
    app: { minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans TC', sans-serif", padding: "0 0 80px" },
    header: { background: C.bg, borderBottom: `0.5px solid ${C.border}`, padding: "18px 20px 0" },
    tabs: { display: "flex", marginTop: 16 },
    tabBtn: (active) => ({
      flex: 1, padding: "10px 0", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
      background: "transparent",
      borderBottom: active ? `2px solid ${C.accent}` : `2px solid transparent`,
      color: active ? C.accent : C.textMuted,
      letterSpacing: "0.4px",
      transition: "all 0.2s"
    }),
    body: { padding: "14px 16px" },
    card: { background: C.card, borderRadius: 8, padding: 16, marginBottom: 10, border: `0.5px solid ${C.border}` },
    cardInner: { background: C.cardInner, borderRadius: 6, padding: 12, border: `0.5px solid ${C.border}` },
    cardTitle: { fontSize: 10, fontWeight: 600, color: C.textSub, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.8px" },
    btn: (color = C.accent) => ({ background: color, color: "white", border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
    outlineBtn: { background: "transparent", border: `0.5px solid ${C.borderStrong}`, borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 500, color: C.textMuted, cursor: "pointer" },
    input: { width: "100%", padding: "10px 12px", borderRadius: 6, border: `0.5px solid ${C.borderStrong}`, fontSize: 13, outline: "none", background: C.bg, color: C.text, boxSizing: "border-box" },
    row: { display: "flex", gap: 8 },
    calBig: { fontSize: 34, fontWeight: 500, color: calRemaining < 0 ? "#C47A5A" : C.accent, lineHeight: 1 },
  };

  if (isLoading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans TC', sans-serif", gap: 14 }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 36 }}>🌿</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>健康日記</div>
      <div style={{ fontSize: 12, color: C.textMuted }}>正在從雲端載入你的資料⋯</div>
    </div>
  );

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.textSub, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 2 }}>Health Journal</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: 18, fontWeight: 500, color: C.text, margin: 0 }}>🌿 健康日記</h1>
              {!isToday && <div style={{ fontSize: 9, fontWeight: 600, color: C.accent, background: C.accentLight, borderRadius: 4, padding: "2px 7px", border: `0.5px solid ${C.accent}44` }}>回溯</div>}
            </div>
            <div style={{ fontSize: 10, color: C.textSub, marginTop: 2 }}>{userEmail}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button style={S.outlineBtn} onClick={() => { setGoalsForm(goals); setShowGoals(true); }}>設定目標</button>
            <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", fontSize: 11, color: C.textSub, cursor: "pointer", padding: "8px 4px" }}>登出</button>
          </div>
        </div>

        {/* 日期導覽 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, background: C.card, borderRadius: 6, padding: "8px 12px", border: `0.5px solid ${C.border}` }}>
          <button onClick={() => shiftDate(-1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.textMuted, lineHeight: 1, padding: "0 2px" }}>‹</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <input type="date" max={today} value={selectedDate}
              onChange={e => { if (e.target.value && e.target.value <= today) { setSelectedDate(e.target.value); setShowWeightInput(false); setShowFoodForm(false); } }}
              style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 500, color: C.text, textAlign: "center", cursor: "pointer", outline: "none", width: "100%" }} />
            <div style={{ fontSize: 9, color: C.textSub, marginTop: 1, letterSpacing: "0.3px" }}>
              {isToday ? "今天" : `${Math.round((new Date(today) - new Date(selectedDate + "T00:00:00")) / 86400000)} 天前`}
            </div>
          </div>
          <button onClick={() => shiftDate(1)} disabled={selectedDate >= today} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: selectedDate >= today ? C.border : C.textMuted, lineHeight: 1, padding: "0 2px" }}>›</button>
          {!isToday && <button onClick={() => { setSelectedDate(today); setShowWeightInput(false); setShowFoodForm(false); }} style={{ ...S.btn(C.accent), padding: "5px 10px", fontSize: 10, borderRadius: 4 }}>今天</button>}
        </div>

        <div style={S.tabs}>
          {[["today", "今日"], ["weight", "體重趨勢"], ["photos", "體態照片"], ["history", "飲食紀錄"]].map(([k, label]) => (
            <button key={k} style={S.tabBtn(tab === k)} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={S.body}>

        {/* 今日 TAB */}
        {tab === "today" && (
          <>
            <div style={S.card}>
              <div style={S.cardTitle}>{isToday ? "今日卡路里" : fmtLong(selectedDate)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Ring value={selectedTotals.calories} max={goals.calories} color={calRemaining < 0 ? C.accent : C.green} size={80} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: C.textMuted }}>
                    {Math.round((selectedTotals.calories / goals.calories) * 100)}%
                  </div>
                </div>
                <div>
                  <div style={S.calBig}>{Math.abs(calRemaining)}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{calRemaining >= 0 ? "大卡 還可以吃 🎉" : "大卡 已超出 ⚠️"}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>已攝取 {selectedTotals.calories} kcal ／ 目標 {goals.calories} kcal</div>
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>營養素</div>
              <NutriBar label="蛋白質" current={selectedTotals.protein} goal={goals.protein} color={C.blue} />
              <NutriBar label="碳水化合物" current={selectedTotals.carbs} goal={goals.carbs} color={C.yellow} />
              <NutriBar label="脂肪" current={selectedTotals.fat} goal={goals.fat} color={C.purple} />
              <NutriBar label="膳食纖維" current={selectedTotals.fiber} goal={goals.fiber} color={C.green} />
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showWeightInput ? 12 : 0 }}>
                <div>
                  <div style={S.cardTitle}>{isToday ? "今日體重" : "體重記錄"}</div>
                  {selectedWeight
                    ? <div style={{ fontSize: 28, fontWeight: 600, color: C.accent }}>{selectedWeight.weight} <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>kg</span></div>
                    : <div style={{ fontSize: 13, color: C.textMuted }}>尚未記錄</div>}
                </div>
                <button style={S.btn()} onClick={() => setShowWeightInput(!showWeightInput)}>{selectedWeight ? "更新" : "+ 記錄"}</button>
              </div>
              {showWeightInput && (
                <div style={S.row}>
                  <input style={S.input} type="number" placeholder="輸入體重 (kg)" value={weightInput}
                    onChange={e => setWeightInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addWeight()} />
                  <button style={S.btn(C.green)} onClick={addWeight}>確認</button>
                </div>
              )}
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={S.cardTitle}>{isToday ? "今日飲食" : "飲食記錄"}</div>
                <button style={S.btn()} onClick={() => setShowFoodForm(!showFoodForm)}>+ 新增</button>
              </div>
              {showFoodForm && (
                <div style={{ background: C.card, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <input style={{ ...S.input, marginBottom: 8 }} placeholder="食物名稱" value={foodForm.name} onChange={e => setFoodForm(p => ({ ...p, name: e.target.value }))} />
                  <div style={{ background: "white", borderRadius: 6, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", border: `0.5px solid ${C.accent}`, }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>自動計算卡路里</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>蛋白質×4 + 碳水×4 + 脂肪×9</div>
                    </div>
                    <div><span style={{ fontSize: 26, fontWeight: 600, color: C.accent }}>{foodForm.calories || 0}</span><span style={{ fontSize: 12, color: C.textMuted, marginLeft: 4 }}>kcal</span></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    {[["protein", "蛋白質 (×4 kcal)", C.blue], ["carbs", "碳水化合物 (×4 kcal)", C.yellow], ["fat", "脂肪 (×9 kcal)", C.purple], ["fiber", "膳食纖維", C.green]].map(([field, label, color]) => (
                      <div key={field}>
                        <div style={{ fontSize: 10, fontWeight: 600, color, marginBottom: 3, paddingLeft: 2 }}>{label}</div>
                        <input style={{ ...S.input, borderColor: color }} type="number" placeholder="0 g" value={foodForm[field]}
                          onChange={e => {
                            const v = e.target.value;
                            setFoodForm(p => {
                              const updated = { ...p, [field]: v };
                              const pr = parseFloat(field === "protein" ? v : p.protein) || 0;
                              const ca = parseFloat(field === "carbs" ? v : p.carbs) || 0;
                              const fa = parseFloat(field === "fat" ? v : p.fat) || 0;
                              if (field !== "fiber") updated.calories = Math.round(pr * 4 + ca * 4 + fa * 9);
                              return updated;
                            });
                          }} />
                      </div>
                    ))}
                  </div>
                  <div style={S.row}>
                    <button style={{ ...S.btn(C.green), flex: 1 }} onClick={addFood}>新增食物</button>
                    <button style={S.outlineBtn} onClick={() => setShowFoodForm(false)}>取消</button>
                  </div>
                </div>
              )}
              {selectedFoods.length === 0 && <div style={{ color: C.textMuted, fontSize: 13, textAlign: "center", padding: "12px 0" }}>{isToday ? "今天還沒有記錄飲食 🍽️" : "這天還沒有記錄飲食 🍽️"}</div>}
              {selectedFoods.map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `0.5px solid ${C.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{f.calories}kcal · 蛋白{f.protein}g · 碳水{f.carbs}g · 脂肪{f.fat}g</div>
                  </div>
                  <button onClick={() => setFoodLog(prev => ({ ...prev, [selectedDate]: prev[selectedDate].filter(x => x.id !== f.id) }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textMuted }}>🗑</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 體重趨勢 TAB */}
        {tab === "weight" && (
          <>
            <div style={{ background: C.accent, borderRadius: 6, padding: "12px 16px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 22 }}>💉</div>
                <div style={{ flex: 1 }}>
                  {!editingShotLabel ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "white" }}>{shotLabel}</div>
                      <button onClick={() => { setShotLabelInput(shotLabel); setEditingShotLabel(true); }} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 5, padding: "1px 6px", fontSize: 10, color: "white", cursor: "pointer" }}>✏️</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <input autoFocus value={shotLabelInput} onChange={e => setShotLabelInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && shotLabelInput.trim()) { setShotLabel(shotLabelInput.trim()); setEditingShotLabel(false); } if (e.key === "Escape") setEditingShotLabel(false); }}
                        style={{ border: "none", borderRadius: 8, padding: "4px 8px", fontSize: 13, fontWeight: 600, color: C.text, outline: "none", background: "white", width: "100%" }} />
                      <button onClick={() => { if (shotLabelInput.trim()) setShotLabel(shotLabelInput.trim()); setEditingShotLabel(false); }} style={{ background: "rgba(255,255,255,0.3)", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "white", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>確認</button>
                    </div>
                  )}
                  {!editingShotDate ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)" }}>
                        {new Date(shotDate + "T00:00:00").toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })}
                        {" · 距今 "}{Math.max(0, Math.round((new Date(today + "T00:00:00") - new Date(shotDate + "T00:00:00")) / 86400000))} 天
                      </div>
                      <button onClick={() => { setShotDateInput(shotDate); setEditingShotDate(true); }} style={{ background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "white", cursor: "pointer", fontWeight: 600 }}>✏️ 編輯</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <input type="date" value={shotDateInput} max={today} onChange={e => setShotDateInput(e.target.value)}
                        style={{ border: "none", borderRadius: 8, padding: "4px 8px", fontSize: 12, fontWeight: 600, color: C.text, outline: "none", background: "white" }} />
                      <button onClick={() => { if (shotDateInput) setShotDate(shotDateInput); setEditingShotDate(false); }} style={{ background: "rgba(255,255,255,0.3)", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "white", cursor: "pointer", fontWeight: 600 }}>確認</button>
                      <button onClick={() => setEditingShotDate(false)} style={{ background: "transparent", border: "none", fontSize: 11, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>取消</button>
                    </div>
                  )}
                </div>
                {weightHistory.length > 0 && (() => {
                  const shotW = weightHistory.find(w => w.date >= shotDate);
                  const latestW = weightHistory[weightHistory.length - 1];
                  if (shotW && latestW && shotW.date !== latestW.date) {
                    const diff = (latestW.weight - shotW.weight).toFixed(1);
                    return (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 600, color: "white" }}>{diff > 0 ? "+" : ""}{diff} kg</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)" }}>自開始以來</div>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>體重曲線（全部）</div>
              <WeightChart data={weightHistory} shotDate={shotDate} />
            </div>

            {weightHistory.length > 0 && (
              <div style={S.card}>
                <div style={S.cardTitle}>統計</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[["最新", weightHistory[weightHistory.length - 1]?.weight + " kg", C.accent], ["最高", Math.max(...weightHistory.map(w => w.weight)) + " kg", C.yellow], ["最低", Math.min(...weightHistory.map(w => w.weight)) + " kg", C.green]].map(([label, val, color]) => (
                    <div key={label} style={{ background: C.bg, borderRadius: 6, padding: "12px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>所有記錄</div>
                {weightHistory.slice().reverse().map(w => {
                  const isShotDay = w.date === shotDate;
                  const prevW = weightHistory[weightHistory.findIndex(h => h.date === w.date) - 1];
                  const diff = prevW ? (w.weight - prevW.weight).toFixed(1) : null;
                  return (
                    <div key={w.date} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `0.5px solid ${C.border}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, color: C.text, fontWeight: w.date === today ? 700 : 400 }}>
                            {new Date(w.date + "T00:00:00").toLocaleDateString("zh-TW", { month: "short", day: "numeric", weekday: "short" })}
                          </span>
                          {isShotDay && <span style={{ fontSize: 10, background: C.accent, color: "white", borderRadius: 50, padding: "1px 6px", fontWeight: 600 }}>💉 注射日</span>}
                          {w.date === today && <span style={{ fontSize: 10, background: C.green, color: "white", borderRadius: 50, padding: "1px 6px", fontWeight: 600 }}>今天</span>}
                        </div>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{w.weight} kg</span>
                      {diff !== null && <span style={{ fontSize: 11, fontWeight: 600, color: diff > 0 ? C.accent : C.green, minWidth: 42, textAlign: "right" }}>{diff > 0 ? "▲" : diff < 0 ? "▼" : "—"}{Math.abs(diff)}</span>}
                      <button onClick={() => setWeightHistory(prev => prev.filter(h => h.date !== w.date))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: C.border, padding: "0 2px" }}>🗑</button>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ ...S.card, borderStyle: "dashed", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>想補登過去的體重？</div>
              <button style={S.btn()} onClick={() => { setTab("today"); setShowWeightInput(true); }}>切換日期後記錄</button>
            </div>
          </>
        )}

        {/* 體態照片 TAB */}
        {tab === "photos" && <PhotosTab photos={photos} setPhotos={setPhotos} today={today} />}

        {/* 飲食紀錄 TAB */}
        {tab === "history" && (
          <div style={S.card}>
            <div style={S.cardTitle}>飲食紀錄</div>
            {Object.keys(foodLog).length === 0 && <div style={{ color: C.textMuted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>還沒有任何飲食記錄</div>}
            {Object.entries(foodLog).sort(([a], [b]) => b.localeCompare(a)).map(([date, foods]) => {
              const total = foods.reduce((a, f) => a + (f.calories || 0), 0);
              return (
                <div key={date} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{fmtShort(date)}</span>
                    <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{total} kcal</span>
                  </div>
                  {foods.map(f => (
                    <div key={f.id} style={{ fontSize: 12, color: C.textMuted, padding: "4px 0 4px 10px", borderLeft: `2px solid ${C.border}`, marginBottom: 3 }}>
                      {f.name} · {f.calories}kcal
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 設定目標 Modal */}
      {showGoals && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: C.card, borderRadius: "12px 12px 0 0", padding: 20, width: "100%", boxSizing: "border-box", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: C.text }}>設定每日目標</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>輸入三大營養素，卡路里自動計算</div>
            <div style={{ background: C.accentLight, borderRadius: 6, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", border: `0.5px solid ${C.accent}55` }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>每日卡路里目標</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>蛋白質×4 + 碳水×4 + 脂肪×9</div>
              </div>
              <div><span style={{ fontSize: 30, fontWeight: 600, color: C.accent }}>{goalsForm.calories}</span><span style={{ fontSize: 12, color: C.textMuted, marginLeft: 4 }}>kcal</span></div>
            </div>
            {[["protein", "蛋白質", C.blue, "×4 kcal/g"], ["carbs", "碳水化合物", C.yellow, "×4 kcal/g"], ["fat", "脂肪", C.purple, "×9 kcal/g"]].map(([key, label, color, hint]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ fontSize: 12, color, fontWeight: 600 }}>{label} (g)</label>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{hint}</span>
                </div>
                <input style={{ ...S.input, borderColor: color }} type="number" value={goalsForm[key]}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setGoalsForm(p => {
                      const u = { ...p, [key]: val };
                      u.calories = Math.round((key === "protein" ? val : p.protein) * 4 + (key === "carbs" ? val : p.carbs) * 4 + (key === "fat" ? val : p.fat) * 9);
                      return u;
                    });
                  }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>膳食纖維 (g)</label>
              <input style={{ ...S.input, marginTop: 4, borderColor: C.green }} type="number" value={goalsForm.fiber} onChange={e => setGoalsForm(p => ({ ...p, fiber: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div style={S.row}>
              <button style={{ ...S.btn(C.green), flex: 1 }} onClick={() => { setGoals(goalsForm); setShowGoals(false); }}>儲存</button>
              <button style={S.outlineBtn} onClick={() => setShowGoals(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

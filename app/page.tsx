"use client";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Bell, Bookmark, Building2, Camera, Check, ChevronRight, CircleHelp, Clock3, Download, Eye, FileText, Layers, LocateFixed, MapPin, Menu, Minus, MessageCircle, Plus, Search, Share2, ShieldCheck, SlidersHorizontal, TrendingUp, X } from "lucide-react";
import ProjectMap from "./MapLoader";
import DiscussionBoard from "./DiscussionBoard";
import WorkspacePages from "./WorkspacePages";
import LoginPage from "./LoginPage";
import AdminDashboard, { AdminProjectDetailActions } from "./AdminDashboard";
import type { AdminProject } from "./AdminDashboard";
import ProjectGallery from "./ProjectGallery";
import { formatCompact, gateSummary, publicProjects } from "./data-gate";
import { getSupabaseClient } from "@/lib/supabase-client";

const cats = ["Semua","Jalan","Gedung","Lainnya"] as const;
type Project = AdminProject;

export default function Home() {
 const [projects,setProjects]=useState<AdminProject[]>(publicProjects),[summary,setSummary]=useState(gateSummary),[refreshing,setRefreshing]=useState(false),[selectedId,setSelectedId]=useState(""),[showDetail,setShowDetail]=useState(false),[detailClosing,setDetailClosing]=useState(false),[detailVersion,setDetailVersion]=useState(0),[photoPreview,setPhotoPreview]=useState(""),[photoUpdated,setPhotoUpdated]=useState(""),[mapStyle,setMapStyle]=useState("standard"),[category,setCategory]=useState("Semua"),[query,setQuery]=useState(""),[tab,setTab]=useState("Rincian & Foto"),[watching,setWatching]=useState(false),[notice,setNotice]=useState(""),[welcome,setWelcome]=useState<{title:string;subtitle:string}|null>(null),[zoom,setZoom]=useState(1),[mobileMenu,setMobileMenu]=useState(false),[activeNav,setActiveNav]=useState("Peta Pembangunan"),[page,setPage]=useState("Peta Pembangunan"),[profileOpen,setProfileOpen]=useState(false),[showIdentity,setShowIdentity]=useState(false),[loading,setLoading]=useState(false),[isLoggedIn,setIsLoggedIn]=useState(false),[accountName,setAccountName]=useState("Siti Wulandari"),[role,setRole]=useState<"warga"|"admin">("warga"),[showAuth,setShowAuth]=useState(false),[authMode,setAuthMode]=useState<"signin"|"signup">("signin");
 useEffect(()=>{setWelcome({title:"Selamat Datang di APERTIO",subtitle:"Lebih Jujur, Lebih Transparan"});const timer=window.setTimeout(()=>setWelcome(null),2000);return()=>window.clearTimeout(timer)},[]);
 
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .maybeSingle();

        const name = profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Warga";
        const userRole = (profile?.role === "admin" ? "admin" : "warga") as "warga" | "admin";
        setAccountName(name);
        setRole(userRole);
        setIsLoggedIn(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .maybeSingle();

        const name = profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Warga";
        const userRole = (profile?.role === "admin" ? "admin" : "warga") as "warga" | "admin";
        setAccountName(name);
        setRole(userRole);
        setIsLoggedIn(true);
      } else if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        setRole("warga");
        setAccountName("Warga Salatiga");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  useEffect(()=>{let stop=false;fetch("/api/packages").then(response=>response.json()).then(data=>{if(stop||data.source!=="supabase"||!Array.isArray(data.projects))return;setProjects(data.projects);if(data.summary)setSummary(data.summary)}).catch(()=>{});return()=>{stop=true}},[]);
 const project:Project=projects.find(p=>p.id===selectedId)??projects[0];
 const filtered=useMemo(()=>projects.filter(p=>(category==="Semua"||p.type===category)&&(p.short+" "+p.title+" "+p.agency).toLowerCase().includes(query.toLowerCase())),[projects,category,query]);
 function toast(s:string){setNotice(s);window.setTimeout(()=>setNotice(""),2500)}
 async function refreshPackages(){if(refreshing)return;setRefreshing(true);try{const response=await fetch("/api/packages/refresh",{method:"POST"});const data=await response.json();if(!response.ok){toast(data.error||"Gagal memperbarui");return}if(Array.isArray(data.projects)&&data.projects.length)setProjects(data.projects);if(data.summary)setSummary(data.summary);toast(data.added?data.added+" paket baru disimpan di Supabase":"Tidak ada paket baru. Yang tersimpan di Supabase tetap dipakai.")}catch{toast("Tidak terhubung ke server")}finally{setRefreshing(false)}}
 function hideDetail(){if(!showDetail||detailClosing)return;setDetailClosing(true);window.setTimeout(()=>{setShowDetail(false);setDetailClosing(false)},280)}
 function navigate(next:string){if(next==="Login"){setAuthMode("signin");setShowAuth(true);setMobileMenu(false);return}if(next===page)return;setLoading(true);setPage(next);setActiveNav(role==="admin"&&["Manajemen Proyek","Daftar Proyek","Statistik","Data Publik","Laporan Warga"].includes(next)?"Manajemen Proyek":next);setMobileMenu(false);window.setTimeout(()=>setLoading(false),420)}
 
  async function handleLogout() {
    setProfileOpen(false);
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsLoggedIn(false);
    setRole("warga");
    setAccountName("Warga Salatiga");
    setPage("Peta Pembangunan");
    setActiveNav("Peta Pembangunan");
    toast("Anda telah berhasil keluar");
  }
  function login(name:string,email:string,accountRole:"warga"|"admin"){setAccountName(name);setRole(accountRole);setIsLoggedIn(true);setShowAuth(false);setPage("Peta Pembangunan");setActiveNav("Peta Pembangunan");setWelcome({title:accountRole==="admin"?"Selamat datang, Admin":"Halo, selamat datang "+name,subtitle:accountRole==="admin"?"Ruang kendali pembangunan APERTIO":"Terus awasi pembangunan Kota Salatiga"});window.setTimeout(()=>setWelcome(null),2000)}
 return <main className={"app "+(page!=="Peta Pembangunan"?"page-mode":"")}>
  <header className="topbar">
   <button className="mobile-menu" onClick={()=>setMobileMenu(!mobileMenu)}><Menu size={20}/></button>
   <button className="wordmark" onClick={()=>navigate("Peta Pembangunan")}><b>APERTIO</b><i>.</i></button>
   <nav className={mobileMenu?"nav-open":""}>
    {(role==="admin"?["Peta Pembangunan","Manajemen Proyek","Data Pelapis"]:["Peta Pembangunan","Lapor Warga","FAQ & Bantuan"]).map(n=><button key={n} className={activeNav===n?"selected":""} onClick={()=>navigate(n)}>{n}</button>)}
   </nav>
   <button className="export-button refresh-data" disabled={refreshing} onClick={refreshPackages}>{refreshing?"Memeriksa SIRUP…":"Perbarui data"}</button>
   {isLoggedIn ? <div className="profile-wrap">
    <button className="user" onClick={()=>setProfileOpen(!profileOpen)}><div className="avatar"><img src="https://i.pravatar.cc/100?img=11" alt={"Foto profil "+accountName}/><i/></div><div><b>{accountName}</b><small>{role==="admin"?"Admin":"Warga"}</small></div><ChevronRight size={15}/></button>
    {profileOpen&&<div className="profile-menu"><div className="profile-menu-head"><div className="avatar"><img src="https://i.pravatar.cc/100?img=11" alt={"Foto profil "+accountName}/></div><span><b>{accountName}</b><small>{role==="admin"?"Admin APERTIO":"Warga · Salatiga"}</small></span></div><button onClick={()=>{setProfileOpen(false);setShowIdentity(true)}}><ShieldCheck size={16}/> Cek data diri</button><button className="logout" onClick={handleLogout}><X size={16}/> Keluar</button></div>}
   </div> : <div className="auth-buttons"><button onClick={()=>{setAuthMode("signin");setShowAuth(true)}}>Sign in</button><button onClick={()=>{setAuthMode("signup");setShowAuth(true)}}>Sign up</button></div>}
  </header>
  {page==="Peta Pembangunan"?<>
  <div className="map"><ProjectMap projects={projects} selected={selectedId} mapStyle={mapStyle} onSelect={(id)=>{setSelectedId(id);setShowDetail(true);setDetailClosing(false);setDetailVersion(v=>v+1)}} onBlank={hideDetail}/><div className="map-style-control"><button onClick={()=>setMapStyle(mapStyle==="standard"?"monochrome":mapStyle==="monochrome"?"dark":"standard")} title="Ganti gaya peta"><Layers size={17}/><span>{mapStyle==="standard"?"Standar":mapStyle==="monochrome"?"Monokrom":"Gelap"}</span><ChevronRight size={14}/></button><div className="map-style-options">{[["standard","Standar"],["monochrome","Monokrom"],["dark","Gelap"]].map(([key,label])=><button key={key} className={mapStyle===key?"active":""} onClick={()=>setMapStyle(key)}><i className={"map-swatch "+key}/>{label}</button>)}</div></div></div>
  <aside className="project-list"><div className="list-search"><Search size={17}/><input placeholder="Cari proyek..." value={query} onChange={e=>setQuery(e.target.value)}/><SlidersHorizontal size={17}/></div><div className="pills">{cats.map(c=><button key={c} className={category===c?"active":""} onClick={()=>setCategory(c)}>{c} <span>{projects.filter(p=>c==="Semua"||p.type===c).length}</span></button>)}</div><p className="gate-note">{summary.note}</p><div className="results">{filtered.map(p=><button key={p.id} className={"result "+(selectedId===p.id?"chosen":"")} onClick={()=>{setSelectedId(p.id);setShowDetail(true);setDetailClosing(false);setDetailVersion(v=>v+1)}}><i className={p.color}/><span><b>{p.short}</b><small className="result-status">{p.status}{p.mappable===false?" · Belum dipetakan":""}</small></span><strong>{p.progressKnown===false?formatCompact(p.paguValue||0):Math.round(p.progress)+"%"}</strong></button>)}{!filtered.length&&<p className="empty">Tidak ada proyek yang cocok.</p>}</div></aside>

  {showDetail&&<section key={detailVersion} className={"panel "+(detailClosing?"panel-closing":"")}><div className="scroll"><div className="heading"><button className="close" aria-label="Tutup detail proyek" onClick={hideDetail}><X size={20}/></button><h1>{project.title}</h1><div className="detail-meta"><span className="category-chip"><Building2 size={14}/>{project.category}</span><span className="status-chip"><i/>{project.progressKnown===false?project.status:project.status+" (+"+(project.progress-project.plan).toFixed(1)+"% Deviasi)"}</span></div></div>
   <div className="actions"><div><button className="primary" onClick={()=>toast("Menampilkan rute ke "+project.short)}><MapPin size={16}/>Navigasi Lokasi</button><button onClick={()=>toast("Tautan proyek disalin")}><Share2 size={16}/>Bagikan</button><button className={watching?"watching":""} onClick={()=>{setWatching(!watching);toast(watching?"Pantauan dihapus":"Proyek ditambahkan ke pantauan")}}><Bookmark size={16}/> {watching?"Dipantau":"Pantau"}</button></div>{role==="admin"&&<AdminProjectDetailActions project={project} onUpdate={p=>setProjects(prev=>prev.map(x=>x.id===p.id?p:x))} onDelete={id=>{setProjects(prev=>prev.filter(x=>x.id!==id));setShowDetail(false)}} onToast={toast}/>}<small>{project.evidence==="rup"?"Kode RUP":"ID"}: <b>{project.id}</b></small></div>
   <ProjectGallery photoUpdates={project.photos} onOpen={(url,time)=>{setPhotoPreview(url);setPhotoUpdated(time)}}/><div className="metrics">{project.progressKnown===false?<><article className="physical"><div>Realisasi Fisik</div><strong>Tidak diumumkan</strong><p>{project.status}</p></article><article className="financial"><div>Pagu APBN <span>TA {summary.fiscalYear}</span></div><strong>{project.budget}</strong><p>Serapan tidak ada di SIRUP</p></article></>:<><article className="physical"><div>Realisasi Fisik <span>+{(project.progress-project.plan).toFixed(1)}%</span></div><strong>{project.progress}% <small>/ Rencana {project.plan}%</small></strong><i><b style={{width:project.progress+"%"}}/></i><p>Tahap pekerjaan berjalan</p></article><article className="financial"><div>Serapan Anggaran <span>Termin III</span></div><strong>{Math.min(project.progress-4,100)}% <small>/ {project.budget}</small></strong><i><b style={{width:Math.min(project.progress-4,100)+"%"}}/></i><p>Pencairan SP2D sesuai jadwal</p></article></>}</div>
   <div className="info">{(project.evidence==="rup"?[["LOKASI DALAM PENGUMUMAN",project.location],["INSTANSI PELAKSANA",project.agency],["PAGU APBN",project.budget],["JADWAL KONTRAK",project.date]]:[["LOKASI TITIK PENGERJAAN",project.location],["ORGANISASI PERANGKAT DAERAH",project.agency],["NILAI KONTRAK PELAKSANAAN",project.contract],["PERIODE PELAKSANAAN",project.date]]).map(([a,b],i)=><article key={a}><label>{a}</label><b className={i===2?"orange":""}>{b}</b>{i===2&&<small>{project.evidence==="rup"?"Nilai kontrak belum diumumkan di SIRUP":project.sourceLabel||"Sumber lokal"}</small>}</article>)}</div>
   <div className="tabs">{["Rincian & Foto","Diskusi Warga"].map((t,i)=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}{i===1&&<b>{project.comments}</b>}</button>)}</div>
   {tab==="Rincian & Foto"?<div className="description"><h2><i/> DESKRIPSI & KRONOLOGI PROYEK</h2><p>{project.description}</p><div className="risk"><b><AlertTriangle size={16}/> Kendala & Tindakan Mitigasi Lapangan</b><p>{project.risk}</p></div></div>:<DiscussionBoard onToast={toast} canContribute={isLoggedIn} onLoginRequest={()=>navigate("Login")}/> }
  </div><footer className="panel-footer"><span><i/> Sumber: <b>{project.sourceLabel||"Data lokal"}{project.evidence==="rup"?" · "+summary.retrievedLabel:""}</b></span><button onClick={()=>project.sourceUrl?window.open(project.sourceUrl,"_blank","noopener,noreferrer"):toast("Sumber publik belum tertaut")}><Download size={15}/> {project.sourceUrl?"Buka pengumuman SIRUP":"Unduh ringkasan"}</button></footer></section>}
  </>:role==="admin"&&["Manajemen Proyek","Daftar Proyek","Statistik","Laporan Warga","Data Publik"].includes(page)?<AdminDashboard page={page} projects={projects} onCreate={p=>{setProjects(prev=>[p,...prev]);setSelectedId(p.id)}} onUpdate={p=>setProjects(prev=>prev.map(x=>x.id===p.id?p:x))} onDelete={id=>setProjects(prev=>prev.filter(x=>x.id!==id))} onToast={toast} onNavigate={navigate}/>:<WorkspacePages page={page} onToast={toast} projects={projects} summary={summary}/>}
  {welcome&&<div key={welcome.title} className="welcome-screen"><span className="welcome-brand">APERTIO<i>.</i></span><div className="welcome-dots"><i/><i/><i/></div><h1>{welcome.title}</h1><p>{welcome.subtitle}</p><div className="welcome-loader"><i/></div></div>}{showAuth&&<LoginPage mode={authMode} onModeChange={setAuthMode} onLogin={login} onBack={()=>setShowAuth(false)}/ >}{photoPreview&&<div className="modal-backdrop photo-backdrop" onClick={()=>setPhotoPreview("")}><section className="photo-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setPhotoPreview("")}><X size={18}/></button><img src={photoPreview} alt="Dokumentasi progres proyek"/><small>Dokumentasi progres fisik proyek · Diperbarui {photoUpdated}</small></section></div>}{loading&&<div className="page-loading"><i/><span>Memuat halaman…</span></div>}{showIdentity&&<div className="modal-backdrop" onClick={()=>setShowIdentity(false)}><section className="identity-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowIdentity(false)}><X size={18}/></button><div className="identity-check"><ShieldCheck size={25}/></div><small>IDENTITAS TERVERIFIKASI</small><h2>Data diri warga</h2><p>Informasi akun yang digunakan untuk berpartisipasi di APERTIO.</p><div><span>Nama lengkap</span><b>Warga Salatiga</b></div><div><span>Status verifikasi</span><b className="verified">Terverifikasi KTP-el</b></div><div><span>Wilayah</span><b>Kota Salatiga</b></div><button className="identity-done" onClick={()=>setShowIdentity(false)}>Selesai</button></section></div>}{notice&&<div className="toast"><Check size={17}/>{notice}</div>}<div className="mobile-bottom"><button onClick={()=>setMobileMenu(!mobileMenu)}><Menu/>Menu</button><button onClick={()=>navigate("Peta Pembangunan")}><MapPin/>Peta</button><button onClick={()=>navigate("Daftar Proyek")}><Eye/>Proyek</button></div>
 </main>
}

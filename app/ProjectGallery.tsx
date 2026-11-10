"use client";
import { Camera } from "lucide-react";
export default function ProjectGallery({photoUpdates,onOpen}:{photoUpdates?:{url:string;label:string;updated:string}[];onOpen:(url:string,updated:string)=>void}){
 const image=(id:string,size:number)=>"https://images.unsplash.com/photo-"+id+"?auto=format&fit=crop&w="+size+"&q=88";
 if(!photoUpdates?.length) return <section className="project-gallery"><header><b><Camera size={15}/> Dokumentasi Proyek Fisik</b><small>Tidak ada foto resmi</small></header><p className="gallery-empty">Pengumuman SIRUP tidak menyertakan foto lapangan. Gambar stok tidak ditampilkan agar tidak tampak seperti dokumentasi paket.</p></section>;
 const fallback=photoUpdates.map((p,idx)=>({label:p.label,id:"",url:p.url,updated:p.updated,idx}));
 const src=(p:typeof fallback[number],size:number)=>p.url||image(p.id,size);
 return <section className="project-gallery"><header><b><Camera size={15}/> Dokumentasi Proyek Fisik</b><small>Update terbaru · {fallback[0].updated}</small></header><button className="gallery-hero" style={{backgroundImage:"linear-gradient(0deg,#101b2caa,transparent 55%),url("+src(fallback[0],1200)+")"}} onClick={()=>onOpen(src(fallback[0],1600),fallback[0].updated)}><span><b>{fallback[0].label}</b><small>Foto utama · Tahap pekerjaan berlangsung</small></span><i>LIHAT FOTO</i></button><div className="gallery-updates">{fallback.slice(1).map((p)=><button key={p.idx} style={{backgroundImage:"linear-gradient(0deg,#101b2c99,transparent 65%),url("+src(p,500)+")"}} onClick={()=>onOpen(src(p,1600),p.updated)}><span>{p.label}</span></button>)}</div></section>;
}

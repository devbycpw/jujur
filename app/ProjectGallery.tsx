"use client";
import { Camera } from "lucide-react";
const defaultImages=[
 ["Pekerjaan pondasi","1504307651254-35680f356dfd"],
 ["Progres konstruksi","1541888946425-d81bb19240f5"],
 ["Pekerjaan struktur","1590644365607-1c5a2c1d1f5c"],
 ["Perbaikan drainase","1516937941344-00b4e0337589"],
 ["Kondisi lapangan","1486406146926-c627a92ad1ab"],
];
export default function ProjectGallery({photoUpdates,onOpen}:{photoUpdates?:{url:string;label:string;updated:string}[];onOpen:(url:string,updated:string)=>void}){
 const image=(id:string,size:number)=>"https://images.unsplash.com/photo-"+id+"?auto=format&fit=crop&w="+size+"&q=88";
 const fallback=photoUpdates?.length?[...photoUpdates.map((p,i)=>({label:p.label,id:"",url:p.url,updated:p.updated,idx:i})),...defaultImages.slice(1).map(([label,id],i)=>({label,id,url:"",updated:["28 Okt 2024 · 10.15","25 Okt 2024 · 16.40","22 Okt 2024 · 09.30","18 Okt 2024 · 11.05"][i],idx:i+photoUpdates.length}))]:defaultImages.map(([label,id],idx)=>({label,id,url:"",updated:["30 Okt 2024 · 14.20","28 Okt 2024 · 10.15","25 Okt 2024 · 16.40","22 Okt 2024 · 09.30","18 Okt 2024 · 11.05"][idx],idx}));
 const src=(p:typeof fallback[number],size:number)=>p.url||image(p.id,size);
 return <section className="project-gallery"><header><b><Camera size={15}/> Dokumentasi Proyek Fisik</b><small>Update terbaru · {fallback[0].updated}</small></header><button className="gallery-hero" style={{backgroundImage:"linear-gradient(0deg,#101b2caa,transparent 55%),url("+src(fallback[0],1200)+")"}} onClick={()=>onOpen(src(fallback[0],1600),fallback[0].updated)}><span><b>{fallback[0].label}</b><small>Foto utama · Tahap pekerjaan berlangsung</small></span><i>LIHAT FOTO</i></button><div className="gallery-updates">{fallback.slice(1).map((p)=><button key={p.idx} style={{backgroundImage:"linear-gradient(0deg,#101b2c99,transparent 65%),url("+src(p,500)+")"}} onClick={()=>onOpen(src(p,1600),p.updated)}><span>{p.label}</span></button>)}</div></section>;
}

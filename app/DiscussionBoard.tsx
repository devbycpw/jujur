"use client";

import { useState } from "react";
import { Camera, ImagePlus, MessageCircle, Send, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";

type Reply = { name: string; text: string };
type Post = { id: number; name: string; avatar: string; time: string; text: string; photo?: string; isReport?: boolean; likes: number; dislikes: number; vote: "" | "like" | "dislike"; replies: Reply[] };

const initialPosts: Post[] = [
  { id: 1, name: "Dian Ayu", avatar: "https://i.pravatar.cc/80?img=47", time: "2 jam lalu", text: "Mohon dipasang lampu penerangan tambahan di jalur pengalihan malam hari. Kemarin cukup gelap saat saya pulang.", photo: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=900&q=80", isReport: true, likes: 18, dislikes: 1, vote: "", replies: [{name:"Budi Santoso",text:"Saya setuju, terutama di dekat akses permukiman."},{name:"Admin DPUPR",text:"Terima kasih, masukan diteruskan ke tim lapangan."}] },
  { id: 2, name: "Budi Santoso", avatar: "https://i.pravatar.cc/80?img=12", time: "Kemarin", text: "Progres di lapangan terlihat semakin baik. Pengecoran sisi timur sudah rapi.", photo: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80", likes: 12, dislikes: 0, vote: "", replies: [] },
  { id: 3, name: "Rina Wulandari", avatar: "https://i.pravatar.cc/80?img=44", time: "2 hari lalu", text: "Apakah akses ke pasar tetap dibuka selama pengerjaan?", likes: 4, dislikes: 0, vote: "", replies: [{name:"Admin DPUPR",text:"Akses pasar tetap dibuka melalui jalur sementara di sisi utara."}] },
];

export default function DiscussionBoard({ onToast, canContribute, onLoginRequest }: { onToast: (message: string) => void; canContribute: boolean; onLoginRequest: () => void }) {
  const [posts, setPosts] = useState(initialPosts);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [reportMode, setReportMode] = useState(false);
  const [replying, setReplying] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  function addPost() {
    if (!canContribute) { onLoginRequest(); return; }
    if (!text.trim() && !photo) return;
    setPosts([{ id: Date.now(), name: "Warga Salatiga", avatar: "https://i.pravatar.cc/80?img=11", time: "Baru saja", text: text.trim(), photo, isReport: reportMode, likes: 0, dislikes: 0, vote: "", replies: [] }, ...posts]);
    setText(""); setPhoto(""); setReportMode(false);
    onToast(reportMode ? "Laporan lapangan berhasil dikirim" : "Komentar berhasil dikirim");
  }
  function setVote(id: number, vote: "like" | "dislike") {
    if (!canContribute) { onLoginRequest(); return; }
    setPosts(posts.map(p => {
      if (p.id !== id) return p;
      const likes = p.likes - (p.vote === "like" ? 1 : 0) + (p.vote !== vote && vote === "like" ? 1 : 0);
      const dislikes = p.dislikes - (p.vote === "dislike" ? 1 : 0) + (p.vote !== vote && vote === "dislike" ? 1 : 0);
      return { ...p, likes, dislikes, vote: p.vote === vote ? "" : vote };
    }));
  }
  function addReply(id: number) {
    if (!canContribute) { onLoginRequest(); return; }
    if (!replyText.trim()) return;
    setPosts(posts.map(p => p.id === id ? { ...p, replies: [...p.replies, {name:"Warga Salatiga",text:replyText.trim()}] } : p));
    setReplyText(""); setReplying(null);
  }
  return <div className="discussion-board">
    <div className="discussion-title"><div><MessageCircle size={19}/><span><b>Diskusi warga & laporan lapangan</b><small>{posts.length} percakapan · warga dapat berbagi foto</small></span></div><button className={reportMode ? "report-mode on" : "report-mode"} onClick={() => setReportMode(!reportMode)}><Camera size={15}/>{reportMode ? "Mode laporan aktif" : "Buat laporan"}</button></div>
    {!canContribute?<div className="guest-contribute"><span><ShieldCheck size={19}/><span><b>Baca diskusi sebagai pengunjung</b><small>Masuk untuk menulis komentar, berbagi foto, membalas, atau memberi reaksi.</small></span></span><button onClick={onLoginRequest}>Masuk untuk berkontribusi</button></div>:<div className="composer"><img src="https://i.pravatar.cc/80?img=11" alt="Foto profil Anda"/><div className="composer-main"><textarea value={text} onChange={e=>setText(e.target.value)} placeholder={reportMode ? "Jelaskan kondisi yang ingin dilaporkan…" : "Bagikan informasi atau ajukan pertanyaan…"} rows={2}/>{photo&&<div className="upload-preview"><img src={photo} alt="Foto yang akan diunggah"/><button onClick={()=>setPhoto("")}>Hapus foto</button></div>}<div className="composer-actions"><label className="upload-button"><ImagePlus size={17}/> Tambah foto<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file){const reader=new FileReader();reader.onload=()=>setPhoto(String(reader.result));reader.readAsDataURL(file)}}}/></label><button className="send-button" onClick={addPost}><Send size={15}/>{reportMode?"Kirim laporan":"Kirim komentar"}</button></div></div></div>}
    <div className="post-list">{posts.map(post=><article className="post" key={post.id}><img className="post-avatar" src={post.avatar} alt={"Foto profil "+post.name}/><div className="post-content"><header><b>{post.name}</b>{post.isReport&&<span className="report-tag"><Camera size={12}/> Laporan lapangan</span>}<small>{post.time}</small></header>{post.text&&<p>{post.text}</p>}{post.photo&&<img className="post-photo" src={post.photo} alt="Foto dokumentasi warga"/>}<div className="post-actions"><button className={post.vote==="like"?"voted":""} onClick={()=>setVote(post.id,"like")}><ThumbsUp size={15}/> Suka <b>{post.likes}</b></button><button className={post.vote==="dislike"?"voted":""} onClick={()=>setVote(post.id,"dislike")}><ThumbsDown size={15}/> Tidak suka <b>{post.dislikes}</b></button><button onClick={()=>{setReplying(replying===post.id?null:post.id);setReplyText("")}}><MessageCircle size={15}/> Balas <b>{post.replies.length}</b></button></div>{post.replies.length>0&&<div className="reply-list">{post.replies.map((reply,i)=><div className="reply" key={i}><span className="reply-avatar">{reply.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><p><b>{reply.name}</b> {reply.text}</p></div>)}</div>}{replying===post.id&&<div className="reply-composer"><input value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addReply(post.id)} placeholder="Tulis balasan…"/><button onClick={()=>addReply(post.id)} aria-label="Kirim balasan"><Send size={15}/></button></div>}</div></article>)}</div>
  </div>;
}

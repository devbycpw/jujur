"use client";
import dynamic from "next/dynamic";
export default dynamic(() => import("./LocationPicker"), { ssr:false, loading:()=> <div className="location-picker-map location-loading">Memuat peta lokasi…</div> });

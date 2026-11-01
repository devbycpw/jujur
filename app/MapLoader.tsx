"use client";

import dynamic from "next/dynamic";
const ProjectMap = dynamic(() => import("./ProjectMap"), { ssr: false, loading: () => <div className="leaflet-loading">Memuat peta…</div> });
export default ProjectMap;

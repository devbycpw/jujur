"use client";

import L from "leaflet";
import { useEffect, useState } from "react";
import { Marker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

function BlankMapClick({ onBlank }: { onBlank: () => void }) {
  useMapEvents({ click: () => onBlank() });
  return null;
}
function FitProjects({ projects }: { projects: { lat?: number; lng?: number }[] }) {
  const map = useMap();
  const signature = projects.map((project) => project.lat !== undefined && project.lng !== undefined ? `${project.lat.toFixed(4)},${project.lng.toFixed(4)}` : "").join("|");
  useEffect(() => {
    const points = projects.filter((project): project is { lat: number; lng: number } => project.lat !== undefined && project.lng !== undefined);
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((project) => [project.lat, project.lng])), { padding: [28, 28] });
  }, [map, signature, projects]);
  return null;
}
function ApplyMapStyle({style}:{style:string}) {
  const map=useMap();
  useEffect(()=>{
    const container=map.getContainer();
    container.classList.remove("map-style-standard","map-style-monochrome","map-style-dark");
    container.classList.add("map-style-"+style);
  },[map,style]);
  return null;
}

export default function ProjectMap({ projects, selected, onSelect, onBlank, mapStyle }: {
  projects: { id: string; short: string; progress: number; lat?:number; lng?:number; progressKnown?:boolean; status?:string }[];
  selected: string;
  onSelect: (id: string) => void;
  onBlank: () => void;
  mapStyle: string;
}) {
  const [clickedId, setClickedId] = useState("");
  const [tilesLoading,setTilesLoading]=useState(true);
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  return <MapContainer className="leaflet-map" center={[-7.15, 110.4]} zoom={8} zoomControl={false} scrollWheelZoom>
    <ApplyMapStyle style={mapStyle}/>
    <FitProjects projects={projects}/>
    <TileLayer key={mapStyle} className={"map-tiles "+mapStyle} attribution={attribution} url={tileUrl} eventHandlers={{loading:()=>setTilesLoading(true),load:()=>setTilesLoading(false)}} />
    <BlankMapClick onBlank={onBlank} />
    {projects.map((project) => {
      if (project.lat===undefined || project.lng===undefined) return null;
      const active = selected === project.id;
      const icon = L.divIcon({
        className: "project-marker-icon",
        html: '<span class="project-marker' + (active ? " active" : "") + (clickedId === project.id ? " clicked" : "") + '"><i></i></span>',
        iconSize: [34, 42],
        iconAnchor: [17, 40],
      });
      return <Marker
        key={project.id}
        position={[project.lat,project.lng]}
        icon={icon}
        eventHandlers={{ click: (event) => {
          L.DomEvent.stopPropagation(event.originalEvent);
          setClickedId(project.id);
          window.setTimeout(() => setClickedId(""), 500);
          onSelect(project.id);
        } }}
      >{active&&<Popup closeButton={false} offset={[0,-28]} autoPan>{<div className="map-project-popup"><small>PAKET TERPILIH</small><b>{project.short}</b>{project.progressKnown===false?<span>{project.status||"Jadwal dari SIRUP"}</span>:<span>Realisasi fisik <strong>{project.progress}%</strong></span>}<i>Titik perkiraan · klik untuk rincian</i></div>}</Popup>}</Marker>;
    })}
    {tilesLoading&&<div className="map-loading"><i/><span>Memuat peta</span></div>}
  </MapContainer>;
}

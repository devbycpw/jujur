"use client";

import L from "leaflet";
import { useEffect, useState } from "react";
import { Marker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

const locations: Record<string, [number, number]> = {
  "SLT-2024-089": [-7.3305, 110.5084],
  "SLT-2024-042": [-7.3268, 110.4976],
  "SLT-2024-061": [-7.3554, 110.4852],
  "SLT-2024-115": [-7.3182, 110.5151],
  "SLT-2024-073": [-7.3417, 110.5232],
};

function BlankMapClick({ onBlank }: { onBlank: () => void }) {
  useMapEvents({ click: () => onBlank() });
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
  projects: { id: string; short: string; progress: number; lat?:number; lng?:number }[];
  selected: string;
  onSelect: (id: string) => void;
  onBlank: () => void;
  mapStyle: string;
}) {
  const [clickedId, setClickedId] = useState("");
  const [tilesLoading,setTilesLoading]=useState(true);
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  return <MapContainer className="leaflet-map" center={[-7.333, 110.505]} zoom={13} zoomControl={false} scrollWheelZoom>
    <ApplyMapStyle style={mapStyle}/>
    <TileLayer key={mapStyle} className={"map-tiles "+mapStyle} attribution={attribution} url={tileUrl} eventHandlers={{loading:()=>setTilesLoading(true),load:()=>setTilesLoading(false)}} />
    <BlankMapClick onBlank={onBlank} />
    {projects.map((project) => {
      const active = selected === project.id;
      const icon = L.divIcon({
        className: "project-marker-icon",
        html: '<span class="project-marker' + (active ? " active" : "") + (clickedId === project.id ? " clicked" : "") + '"><i></i></span>',
        iconSize: [34, 42],
        iconAnchor: [17, 40],
      });
      return <Marker
        key={project.id}
        position={project.lat!==undefined&&project.lng!==undefined?[project.lat,project.lng]:locations[project.id]??[-7.333,110.505]}
        icon={icon}
        eventHandlers={{ click: (event) => {
          L.DomEvent.stopPropagation(event.originalEvent);
          setClickedId(project.id);
          window.setTimeout(() => setClickedId(""), 500);
          onSelect(project.id);
        } }}
      >{active&&<Popup closeButton={false} offset={[0,-28]} autoPan>{<div className="map-project-popup"><small>PROYEK TERPILIH</small><b>{project.short}</b><span>Realisasi fisik <strong>{project.progress}%</strong></span><i>Klik untuk melihat rincian proyek</i></div>}</Popup>}</Marker>;
    })}
    {tilesLoading&&<div className="map-loading"><i/><span>Memuat peta</span></div>}
  </MapContainer>;
}

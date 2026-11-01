"use client";
import L from "leaflet";
import { useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

function ClickToPick({onChange}:{onChange:(lat:number,lng:number)=>void}){useMapEvents({click:e=>onChange(e.latlng.lat,e.latlng.lng)});return null}
export default function LocationPicker({lat,lng,onChange}:{lat:number;lng:number;onChange:(lat:number,lng:number)=>void}){
 const icon=useMemo(()=>L.divIcon({className:"project-marker-icon",html:'<span class="project-marker active"><i></i></span>',iconSize:[34,42],iconAnchor:[17,40]}),[]);
 return <MapContainer className="location-picker-map" center={[lat,lng]} zoom={14} scrollWheelZoom>
  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
  <ClickToPick onChange={onChange}/><Marker position={[lat,lng]} icon={icon} draggable eventHandlers={{dragend:e=>{const p=e.target.getLatLng();onChange(p.lat,p.lng)}}}/>
 </MapContainer>;
}

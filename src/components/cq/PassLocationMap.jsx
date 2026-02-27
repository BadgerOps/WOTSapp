import { useState, useRef, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons (standard bundler workaround)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PASS_STAGE_LABELS = {
  enroute_to: "Enroute To",
  arrived: "Arrived",
  enroute_back: "Enroute Back",
};

function MapBoundsUpdater({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, positions]);
  return null;
}

function FlyToHandler({ target, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], 15, { duration: 0.8 });
    const ref = markerRefs.current[target.id];
    if (ref) {
      setTimeout(() => ref.openPopup(), 800);
    }
  }, [map, target, markerRefs]);
  return null;
}

export default function PassLocationMap({ personnelOnPass }) {
  const [flyTarget, setFlyTarget] = useState(null);
  const markerRefs = useRef({});

  const withLocation = useMemo(
    () =>
      personnelOnPass.filter(
        (p) => p.statusDetails?.lastLocation?.lat && p.statusDetails?.lastLocation?.lng,
      ),
    [personnelOnPass],
  );

  const withoutLocation = useMemo(
    () =>
      personnelOnPass.filter(
        (p) => !p.statusDetails?.lastLocation?.lat || !p.statusDetails?.lastLocation?.lng,
      ),
    [personnelOnPass],
  );

  const positions = useMemo(
    () =>
      withLocation.map((p) => [
        p.statusDetails.lastLocation.lat,
        p.statusDetails.lastLocation.lng,
      ]),
    [withLocation],
  );

  // Default center: Fort Novosel, AL (Rucker) — reasonable default for WOCS
  const defaultCenter = [31.3448, -85.7282];

  if (personnelOnPass.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <p className="font-medium">No personnel on pass</p>
        <p className="text-sm mt-1">
          When personnel go on pass, their locations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        {/* Map */}
        <div className="flex-1 min-w-0">
          {withLocation.length === 0 ? (
            <div className="h-[400px] lg:h-[500px] flex items-center justify-center bg-gray-50 text-gray-500">
              <div className="text-center p-4">
                <svg
                  className="w-10 h-10 mx-auto mb-2 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <p className="font-medium text-sm">No locations shared yet</p>
                <p className="text-xs mt-1">
                  {personnelOnPass.length} personnel on pass — waiting for
                  location sharing
                </p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={positions[0] || defaultCenter}
              zoom={13}
              className="h-[400px] lg:h-[500px] w-full"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBoundsUpdater positions={positions} />
              <FlyToHandler target={flyTarget} markerRefs={markerRefs} />
              {withLocation.map((person) => {
                const loc = person.statusDetails.lastLocation;
                return (
                  <Marker
                    key={person.id}
                    position={[loc.lat, loc.lng]}
                    ref={(ref) => {
                      if (ref) markerRefs.current[person.id] = ref;
                    }}
                  >
                    <Popup>
                      <div className="text-sm min-w-[160px]">
                        <div className="font-semibold">
                          {person.lastName}, {person.firstName}
                        </div>
                        {person.statusDetails?.destination && (
                          <div className="text-gray-600 mt-1">
                            Dest: {person.statusDetails.destination}
                          </div>
                        )}
                        {person.statusDetails?.passStage && (
                          <div className="text-gray-600">
                            Stage:{" "}
                            {PASS_STAGE_LABELS[person.statusDetails.passStage] ||
                              person.statusDetails.passStage}
                          </div>
                        )}
                        <div className="text-gray-500 mt-1 text-xs">
                          Updated: {locationTimeAgo(loc.timestamp)}
                        </div>
                        {person.statusDetails.locationUpdates?.length > 1 && (
                          <div className="text-gray-500 text-xs">
                            {person.statusDetails.locationUpdates.length}{" "}
                            check-ins
                          </div>
                        )}
                        {loc.accuracy && (
                          <div className="text-gray-400 text-xs">
                            Accuracy: ~{Math.round(loc.accuracy)}m
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-gray-200">
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">
              Personnel on Pass ({personnelOnPass.length})
            </h3>
          </div>
          <div className="overflow-y-auto max-h-[250px] lg:max-h-[458px]">
            {withLocation.length > 0 && (
              <div>
                <div className="px-3 py-1.5 bg-blue-50 text-xs font-medium text-blue-700 border-b border-blue-100">
                  Location shared ({withLocation.length})
                </div>
                {withLocation.map((person) => (
                  <button
                    key={person.id}
                    onClick={() =>
                      setFlyTarget({
                        id: person.id,
                        lat: person.statusDetails.lastLocation.lat,
                        lng: person.statusDetails.lastLocation.lng,
                      })
                    }
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-blue-500 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        fill="white"
                      />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {person.lastName}, {person.firstName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {person.statusDetails?.destination || "On pass"}
                        {" · "}
                        {locationTimeAgo(
                          person.statusDetails.lastLocation.timestamp,
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {withoutLocation.length > 0 && (
              <div>
                <div className="px-3 py-1.5 bg-gray-100 text-xs font-medium text-gray-500 border-b border-gray-200">
                  No location ({withoutLocation.length})
                </div>
                {withoutLocation.map((person) => (
                  <div
                    key={person.id}
                    className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 opacity-60"
                  >
                    <svg
                      className="w-4 h-4 text-gray-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-sm text-gray-700 truncate">
                        {person.lastName}, {person.firstName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {person.statusDetails?.destination || "On pass"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function locationTimeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The map document rendered inside the WebView.
 *
 * OpenStreetMap through Leaflet rather than Google Maps: the Google Maps Platform needs a
 * key and a billing account (docs/05 §2), and neither exists yet. OSM needs neither, and
 * its coverage of Lahore's DHA phases, Gulberg and Johar Town is good.
 *
 * Two things to settle before this ships:
 *
 * 1. **Tiles.** `tile.openstreetmap.org` is the community server and its usage policy
 *    rules out a commercial app's traffic. Point `TILE_URL` at a provider (MapTiler,
 *    Thunderforest) or a self-hosted cache before launch. The attribution stays either way
 *    — OSM data is ODbL and crediting it is a licence condition, not a courtesy.
 * 2. **Leaflet is loaded from a CDN.** That breaks the offline tolerance docs/04 §6 asks
 *    for. Vendor the library into the bundle when this becomes a shipping screen.
 */

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  /** Drawn filled when this is the selected pin. */
  selected: boolean;
}

const LEAFLET_VERSION = '1.9.4';
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Builds the document. Everything is inlined and the marker set is serialised in, so the
 * WebView never needs a second round trip to render.
 */
export function buildMapHtml({
  markers,
  center,
  zoom = 12,
  accentColor,
  inkColor,
}: {
  markers: MapMarker[];
  center: { latitude: number; longitude: number };
  zoom?: number;
  accentColor: string;
  inkColor: string;
}): string {
  // JSON goes inside a script tag, so a literal `</script>` in the data would close it early.
  const payload = JSON.stringify(markers).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #FBFBFB; }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.75); }
  .pin {
    width: 34px; height: 34px; border-radius: 12px;
    background: #FFFFFF; border: 2px solid ${accentColor};
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(32,34,44,0.18);
  }
  .pin.selected { background: ${accentColor}; }
  .pin span { width: 12px; height: 12px; border-radius: 6px; background: ${accentColor}; }
  .pin.selected span { background: ${inkColor}; }
  .pin::after {
    content: ''; position: absolute; bottom: -6px; left: 50%; margin-left: -5px;
    border-left: 5px solid transparent; border-right: 5px solid transparent;
    border-top: 6px solid ${accentColor};
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"></script>
<script>
  (function () {
    function send(message) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    }

    if (typeof L === 'undefined') {
      // The CDN did not load — tell the app so it can show a fallback rather than a blank.
      send({ type: 'error', reason: 'leaflet_unavailable' });
      return;
    }

    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([${center.latitude}, ${center.longitude}], ${zoom});

    L.tileLayer('${TILE_URL}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    var markers = JSON.parse('${payload}');
    var bounds = [];

    markers.forEach(function (marker) {
      var icon = L.divIcon({
        className: '',
        html: '<div class="pin' + (marker.selected ? ' selected' : '') + '"><span></span></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 40],
      });

      L.marker([marker.latitude, marker.longitude], { icon: icon, title: marker.label })
        .addTo(map)
        .on('click', function () {
          send({ type: 'marker', id: marker.id });
        });

      bounds.push([marker.latitude, marker.longitude]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [60, 60] });
    }

    map.on('click', function () { send({ type: 'background' }); });
    send({ type: 'ready' });
  })();
</script>
</body>
</html>`;
}

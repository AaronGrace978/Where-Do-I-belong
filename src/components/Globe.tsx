import "../cesiumSetup";
import { useEffect, useRef } from "react";
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  defined,
  HeightReference,
  HorizontalOrigin,
  ImageryLayer,
  Ion,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  VerticalOrigin,
  Viewer,
  createGooglePhotorealistic3DTileset,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { ArchetypeId, PinPlace } from "../lib/types";
import { ARCHETYPE_META } from "../lib/archetypes";
import { CITIES } from "../data/cities";

export interface GlobeHandle {
  flyTo: (place: PinPlace, height?: number) => void;
}

interface Props {
  pin: PinPlace | null;
  pins: PinPlace[];
  archetype: ArchetypeId | null;
  ionToken: string;
  globeMode: "satellite" | "ion" | "photoreal";
  hasDossier?: boolean;
  onPick: (place: PinPlace) => void;
  onReady?: () => void;
}

export default function Globe({
  pin,
  pins,
  archetype,
  ionToken,
  globeMode,
  hasDossier = false,
  onPick,
  onReady,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const spinRef = useRef(true);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!el.current) return;
    let destroyed = false;
    let removeTick: (() => void) | undefined;
    let handler: ScreenSpaceEventHandler | undefined;

    const esri = new UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maximumLevel: 19,
      credit: "Esri · Maxar · Earthstar Geographics",
    });

    const viewer = new Viewer(el.current, {
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      creditContainer: document.createElement("div"),
      baseLayer: new ImageryLayer(esri),
    });
    viewerRef.current = viewer;

    viewer.scene.globe.enableLighting = false;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    viewer.scene.fog.enabled = true;
    viewer.scene.highDynamicRange = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 120;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4.5e7;
    viewer.clock.shouldAnimate = true;
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(-30, 12, 20_500_000),
    });

    const onResize = () => {
      if (!viewer.isDestroyed()) viewer.resize();
    };
    window.addEventListener("resize", onResize);

    const tick = () => {
      if (spinRef.current && viewer && !viewer.isDestroyed()) {
        viewer.camera.rotate(Cartesian3.UNIT_Z, -0.00028);
      }
    };
    viewer.clock.onTick.addEventListener(tick);
    removeTick = () => viewer.clock.onTick.removeEventListener(tick);

    let down: Cartesian2 | undefined;
    handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((e: { position: Cartesian2 }) => {
      down = Cartesian2.clone(e.position);
      spinRef.current = false;
    }, ScreenSpaceEventType.LEFT_DOWN);
    handler.setInputAction(() => {
      spinRef.current = false;
    }, ScreenSpaceEventType.WHEEL);
    handler.setInputAction((e: { position: Cartesian2 }) => {
      if (!down) return;
      const dist = Cartesian2.distance(down, e.position);
      down = undefined;
      if (dist > 6) return;

      const picked = viewer.scene.pick(e.position) as { id?: { _wdib?: PinPlace } } | undefined;
      if (picked?.id?._wdib) {
        onPickRef.current(picked.id._wdib);
        return;
      }

      const cartesian = viewer.camera.pickEllipsoid(e.position, viewer.scene.globe.ellipsoid);
      if (!defined(cartesian) || !cartesian) return;
      const carto = Cartographic.fromCartesian(cartesian);
      const lat = CesiumMath.toDegrees(carto.latitude);
      const lon = CesiumMath.toDegrees(carto.longitude);
      const near = CITIES.map((c) => ({
        c,
        d: (c.lat - lat) ** 2 + (c.lon - lon) ** 2,
      })).sort((a, b) => a.d - b.d)[0];
      const snap = near && near.d < 1.2 ? near.c : null;
      onPickRef.current(
        snap
          ? {
              name: snap.name,
              lat: snap.lat,
              lon: snap.lon,
              city: snap,
              country: snap.country,
            }
          : { name: "This place", lat, lon },
      );
    }, ScreenSpaceEventType.LEFT_UP);

    void (async () => {
      if (ionToken) Ion.defaultAccessToken = ionToken;
      try {
        if (globeMode === "ion" && ionToken) {
          viewer.terrainProvider = await createWorldTerrainAsync();
          const buildings = await createOsmBuildingsAsync();
          if (!destroyed) viewer.scene.primitives.add(buildings);
        } else if (globeMode === "photoreal" && ionToken) {
          viewer.scene.globe.show = false;
          const tileset = await createGooglePhotorealistic3DTileset();
          if (!destroyed) viewer.scene.primitives.add(tileset);
        }
      } catch (err) {
        console.warn("Cesium ion extras failed, staying on satellite globe", err);
        viewer.scene.globe.show = true;
      }
      if (!destroyed) onReady?.();
    })();

    return () => {
      destroyed = true;
      spinRef.current = false;
      window.removeEventListener("resize", onResize);
      removeTick?.();
      handler?.destroy();
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
    // globeMode/ionToken re-init on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globeMode, ionToken]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.entities.removeAll();

    const show = archetype
      ? CITIES.filter((c) => c.scores[archetype] >= 70).map((c) => ({
          name: c.name,
          lat: c.lat,
          lon: c.lon,
          city: c,
          country: c.country,
          reason: ARCHETYPE_META[archetype].short,
        }))
      : pins;

    const color = archetype ? Color.fromCssColorString(ARCHETYPE_META[archetype].color) : Color.fromCssColorString("#d4a853");

    for (const p of show) {
      const entity = viewer.entities.add({
        name: p.name,
        position: Cartesian3.fromDegrees(p.lon, p.lat),
        point: {
          pixelSize: 11,
          color,
          outlineColor: Color.WHITE.withAlpha(0.85),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new NearFarScalar(1.5e5, 1.4, 8.0e6, 0.6),
        },
        label: {
          text: p.name,
          font: "500 13px Outfit, sans-serif",
          fillColor: Color.fromCssColorString("#f4efe4"),
          outlineColor: Color.fromCssColorString("#07090d"),
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(10, -4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new NearFarScalar(2.0e5, 1, 6.0e6, 0.0),
        },
      });
      (entity as unknown as { _wdib: PinPlace })._wdib = p;
    }

    if (pin) {
      viewer.entities.add({
        name: "You are here",
        position: Cartesian3.fromDegrees(pin.lon, pin.lat, 40),
        point: {
          pixelSize: 16,
          color: Color.fromCssColorString("#f4efe4"),
          outlineColor: Color.fromCssColorString("#d4a853"),
          outlineWidth: 3,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: pin.name,
          font: "600 15px Fraunces, serif",
          fillColor: Color.fromCssColorString("#d4a853"),
          outlineColor: Color.fromCssColorString("#07090d"),
          outlineWidth: 5,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
  }, [pins, pin, archetype]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !pin || viewer.isDestroyed()) return;
    spinRef.current = false;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(pin.lon, pin.lat, 2_200_000),
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(-72),
        roll: 0,
      },
      duration: 2.3,
    });
  }, [pin?.lat, pin?.lon, pin?.name]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const id = requestAnimationFrame(() => {
      if (!viewer.isDestroyed()) viewer.resize();
    });
    return () => cancelAnimationFrame(id);
  }, [hasDossier]);

  return (
    <div className={hasDossier ? "globe-wrap has-dossier" : "globe-wrap"}>
      <div ref={el} className="globe-canvas" />
      <div className="globe-hint">
        Drag to spin · Click to drop a pin · Scroll into every street
      </div>
    </div>
  );
}

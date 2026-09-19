import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/tools/geojson-toolbox',
      name: 'geojson-toolbox',
      component: () => import('../views/GeoJsonToolView.vue').then(m => m.default),
    },
    {
      path: '/tools/kml-convert',
      name: 'kml-convert',
      component: () => import('../views/KmlConvertView.vue').then(m => m.default),
    },
    {
      path: '/tools/wkt-wkb',
      name: 'wkt-wkb',
      component: () => import('../views/WktWkbView.vue').then(m => m.default),
    },
    {
      path: '/tools/dxf-tool',
      name: 'dxf-tool',
      component: () => import('../views/DxfToolView.vue').then(m => m.default),
    },
    {
      path: '/tools/gpx-tool',
      name: 'gpx-tool',
      component: () => import('../views/GpxToolView.vue').then(m => m.default),
    },
    {
      path: '/tools/table-convert',
      name: 'table-convert',
      component: () => import('../views/TableConvertView.vue').then(m => m.default),
    },
    {
      path: '/tools/shp-toolbox',
      name: 'shp-toolbox',
      component: () => import('../views/ShpToolView.vue').then(m => m.default),
    },
    {
      path: '/tools/topojson-convert',
      name: 'topojson-convert',
      component: () => import('../views/TopoJsonView.vue').then(m => m.default),
    },
    {
      path: '/tools/polyline-codec',
      name: 'polyline-codec',
      component: () => import('../views/PolylineView.vue').then(m => m.default),
    },
    {
      path: '/tools/geobuf-codec',
      name: 'geobuf-codec',
      component: () => import('../views/GeobufView.vue').then(m => m.default),
    },
    {
      path: '/tools/osm-parser',
      name: 'osm-parser',
      component: () => import('../views/OsmView.vue').then(m => m.default),
    },
    {
      path: '/tools/coord-workbench',
      name: 'coord-workbench',
      component: () => import('../views/CoordWorkbenchView.vue').then(m => m.default),
    },
    {
      path: '/tools/band-lookup',
      name: 'band-lookup',
      component: () => import('../views/BandLookupView.vue').then(m => m.default),
    },
    {
      path: '/tools/epsg-lookup',
      name: 'epsg-lookup',
      component: () => import('../views/EpsgLookupView.vue').then(m => m.default),
    },
    {
      path: '/tools/seven-param',
      name: 'seven-param',
      component: () => import('../views/SevenParamView.vue').then(m => m.default),
    },
    {
      path: '/tools/coord-clean',
      name: 'coord-clean',
      component: () => import('../views/CoordCleanView.vue').then(m => m.default),
    },
    {
      path: '/tools/reproject',
      name: 'reproject',
      component: () => import('../views/ReprojectView.vue').then(m => m.default),
    },
    {
      path: '/tools/scale-calc',
      name: 'scale-calc',
      component: () => import('../views/ScaleCalcView.vue').then(m => m.default),
    },
    {
      path: '/tools/feature-merge',
      name: 'feature-merge',
      component: () => import('../views/FeatureMergeView.vue').then(m => m.default),
    },
    {
      path: '/tools/geojson-splitter',
      name: 'geojson-splitter',
      component: () => import('../views/GeoJsonSplitterView.vue').then(m => m.default),
    },
    {
      path: '/tools/vws-simplify',
      name: 'vws-simplify',
      component: () => import('../views/VwsView.vue').then(m => m.default),
    },
    {
      path: '/tools/field-calc',
      name: 'field-calc',
      component: () => import('../views/FieldCalcView.vue').then(m => m.default),
    },
    {
      path: '/tools/dissolve',
      name: 'dissolve',
      component: () => import('../views/DissolveView.vue').then(m => m.default),
    },
    {
      path: '/tools/geometry-flatten',
      name: 'geometry-flatten',
      component: () => import('../views/GeometryFlattenView.vue').then(m => m.default),
    },
    {
      path: '/tools/topology-check',
      name: 'topology-check',
      component: () => import('../views/TopologyCheckView.vue').then(m => m.default),
    },
    {
      path: '/tools/map-sheet',
      name: 'map-sheet',
      component: () => import('../views/MapSheetView.vue').then(m => m.default),
    },
    {
      path: '/tools/spatial-analysis',
      name: 'spatial-analysis',
      component: () => import('../views/SpatialAnalysisView.vue').then(m => m.default),
    },
    {
      path: '/tools/overlay-analysis',
      name: 'overlay-analysis',
      component: () => import('../views/OverlayView.vue').then(m => m.default),
    },
    {
      path: '/tools/voronoi-triangulation',
      name: 'voronoi-triangulation',
      component: () => import('../views/VoronoiView.vue').then(m => m.default),
    },
    {
      path: '/tools/convex-hull',
      name: 'convex-hull',
      component: () => import('../views/ConvexHullView.vue').then(m => m.default),
    },
    {
      path: '/tools/nearest-neighbor',
      name: 'nearest-neighbor',
      component: () => import('../views/NearestNeighborView.vue').then(m => m.default),
    },
    {
      path: '/tools/distance-matrix',
      name: 'distance-matrix',
      component: () => import('../views/DistanceMatrixView.vue').then(m => m.default),
    },
    {
      path: '/tools/h3-s2-grid',
      name: 'h3-s2-grid',
      component: () => import('../views/H3S2GridView.vue').then(m => m.default),
    },
    {
      path: '/tools/buffer-gen',
      name: 'buffer-gen',
      component: () => import('../views/BufferView.vue').then(m => m.default),
    },
    {
      path: '/tools/geohash',
      name: 'geohash',
      component: () => import('../views/GeohashView.vue').then(m => m.default),
    },
    {
      path: '/tools/line-resample',
      name: 'line-resample',
      component: () => import('../views/LineResampleView.vue').then(m => m.default),
    },
    {
      path: '/tools/geojson-to-svg',
      name: 'geojson-to-svg',
      component: () => import('../views/GeoJsonToSvgView.vue').then(m => m.default),
    },
    {
      path: '/tools/colormap',
      name: 'colormap',
      component: () => import('../views/ColormapView.vue').then(m => m.default),
    },
    {
      path: '/tools/choropleth',
      name: 'choropleth',
      component: () => import('../views/ChoroplethView.vue').then(m => m.default),
    },
    {
      path: '/tools/heatmap',
      name: 'heatmap',
      component: () => import('../views/HeatmapView.vue').then(m => m.default),
    },
    {
      path: '/tools/contour',
      name: 'contour',
      component: () => import('../views/ContourView.vue').then(m => m.default),
    },
    {
      path: '/tools/map-layout',
      name: 'map-layout',
      component: () => import('../views/MapLayoutView.vue').then(m => m.default),
    },
    {
      path: '/tools/tile-tools',
      name: 'tile-tools',
      component: () => import('../views/TileToolView.vue').then(m => m.default),
    },
    {
      path: '/tools/tile-downloader',
      name: 'tile-downloader',
      component: () => import('../views/TileDownloaderView.vue').then(m => m.default),
    },
    {
      path: '/tools/cesium-camera',
      name: 'cesium-camera',
      component: () => import('../views/CesiumCameraView.vue').then(m => m.default),
    },
    {
      path: '/tools/3d-tiles-inspector',
      name: '3d-tiles-inspector',
      component: () => import('../views/ThreeDTilesView.vue').then(m => m.default),
    },
    {
      path: '/tools/czml-generator',
      name: 'czml-generator',
      component: () => import('../views/CzmlView.vue').then(m => m.default),
    },
    {
      path: '/tools/gltf-info',
      name: 'gltf-info',
      component: () => import('../views/GltfView.vue').then(m => m.default),
    },
    {
      path: '/tools/dem-tools',
      name: 'dem-tools',
      component: () => import('../views/DemView.vue').then(m => m.default),
    },
    {
      path: '/tools/ifc-parser',
      name: 'ifc-parser',
      component: () => import('../views/IfcView.vue').then(m => m.default),
    },
    {
      path: '/tools/citygml-parser',
      name: 'citygml-parser',
      component: () => import('../views/CityGmlView.vue').then(m => m.default),
    },
    {
      path: '/tools/pointcloud-info',
      name: 'pointcloud-info',
      component: () => import('../views/PointCloudView.vue').then(m => m.default),
    },
    {
      path: '/tools/building-volume',
      name: 'building-volume',
      component: () => import('../views/BuildingVolumeView.vue').then(m => m.default),
    },
    {
      path: '/tools/wms-capabilities',
      name: 'wms-capabilities',
      component: () => import('../views/WmsCapView.vue').then(m => m.default),
    },
    {
      path: '/tools/arcgis-rest',
      name: 'arcgis-rest',
      component: () => import('../views/ArcGisView.vue').then(m => m.default),
    },
    {
      path: '/tools/tilejson',
      name: 'tilejson',
      component: () => import('../views/TileJsonView.vue').then(m => m.default),
    },
    {
      path: '/tools/wms-url-builder',
      name: 'wms-url-builder',
      component: () => import('../views/WmsUrlView.vue').then(m => m.default),
    },
    {
      path: '/tools/map-picker',
      name: 'map-picker',
      component: () => import('../views/MapPickerView.vue').then(m => m.default),
    },
    {
      path: '/tools/base64',
      name: 'base64',
      component: () => import('../views/Base64View.vue').then(m => m.default),
    },
  ],
})

export default router

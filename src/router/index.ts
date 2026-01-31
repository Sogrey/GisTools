import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ShpConvertView from '../views/ShpConvertView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/tools/shp2geojson',
      name: 'shp2geojson',
      component: ShpConvertView,
    },
    {
      path: '/tools/geojson2shp',
      name: 'geojson2shp',
      component: () => import('../views/GeoJsonConvertView.vue').then(m => m.default),
    },
    {
      path: '/tools/csv2shp',
      name: 'csv2shp',
      component: () => import('../views/CsvConvertView.vue').then(m => m.default),
    },
    {
      path: '/tools/geojson-validate',
      name: 'geojson-validate',
      component: () => import('../views/GeoJsonValidateView.vue').then(m => m.default),
    },
  ],
})

export default router

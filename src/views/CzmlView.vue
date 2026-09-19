<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">CZML 生成器</h1>
      <span class="page-subtitle">表单配置 Cesium 实体 → CZML JSON · 支持动态轨迹插值</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">实体列表</span></div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom:0.5rem">
              <button class="btn btn-primary btn-small" @click="add('point')">＋点</button>
              <button class="btn btn-primary btn-small" @click="add('line')">＋线</button>
              <button class="btn btn-primary btn-small" @click="add('polygon')">＋面</button>
              <button class="btn btn-primary btn-small" @click="add('label')">＋标签</button>
              <button class="btn btn-primary btn-small" @click="add('ellipse')">＋椭圆</button>
            </div>
            <div v-for="e in entities" :key="e.id" class="action-row" style="margin-bottom:0.25rem;cursor:pointer;padding:4px 8px;border-radius:7px" :style="{ background: e.id === selectedId ? 'rgba(102,126,234,0.1)' : 'transparent', border: e.id === selectedId ? '1px solid rgba(102,126,234,0.3)' : '1px solid transparent' }" @click="selectedId = e.id">
              <span class="tag">{{ TYPE_META[e.type].icon }}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.8125rem">{{ e.name }}</span>
              <button class="btn btn-secondary btn-small" @click.stop="del(e.id)">×</button>
            </div>
            <template v-if="selectedEntity">
              <div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:0.5rem;padding-top:0.5rem">
                <div class="form-group">
                  <label class="form-label">名称</label>
                  <input class="form-input" v-model="selectedEntity.name" />
                </div>
                <template v-if="selectedEntity.type === 'point'">
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <label class="form-label" style="margin:0;min-width:auto">模式</label>
                    <button class="btn btn-small" :class="selectedEntity.mode === 'static' ? 'btn-primary' : 'btn-secondary'" @click="selectedEntity.mode = 'static'">静态</button>
                    <button class="btn btn-small" :class="selectedEntity.mode === 'track' ? 'btn-primary' : 'btn-secondary'" @click="selectedEntity.mode = 'track'">轨迹</button>
                  </div>
                  <template v-if="selectedEntity.mode === 'static'">
                    <div class="action-row" style="margin-bottom:0.5rem">
                      <input class="form-input" type="number" v-model.number="selectedEntity.lng" step="any" style="width:100px" placeholder="经度" />
                      <input class="form-input" type="number" v-model.number="selectedEntity.lat" step="any" style="width:100px" placeholder="纬度" />
                      <input class="form-input" type="number" v-model.number="selectedEntity.alt" step="any" style="width:80px" placeholder="高度" />
                    </div>
                  </template>
                  <template v-else>
                    <div class="form-group">
                      <label class="form-label">轨迹点（每行：经, 纬, 高）</label>
                      <textarea class="form-textarea" v-model="selectedEntity.track" style="min-height:120px"></textarea>
                    </div>
                    <div class="action-row" style="margin-bottom:0.5rem">
                      <label class="form-label" style="margin:0;min-width:auto">时长(秒)</label>
                      <input class="form-input" type="number" v-model.number="selectedEntity.trackDur" step="any" style="width:100px" />
                    </div>
                  </template>
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <input type="color" v-model="selectedEntity.color" style="width:34px;height:28px" />
                    <label class="form-label" style="margin:0;min-width:auto">像素</label>
                    <input class="form-input" type="number" v-model.number="selectedEntity.pixelSize" step="any" style="width:70px" />
                  </div>
                </template>
                <template v-if="selectedEntity.type === 'line'">
                  <div class="form-group">
                    <label class="form-label">顶点（每行：经, 纬, 高）</label>
                    <textarea class="form-textarea" v-model="selectedEntity.positions" style="min-height:120px"></textarea>
                  </div>
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <input type="color" v-model="selectedEntity.color" style="width:34px;height:28px" />
                    <label class="form-label" style="margin:0;min-width:auto">宽度</label>
                    <input class="form-input" type="number" v-model.number="selectedEntity.width" step="any" style="width:70px" />
                  </div>
                </template>
                <template v-if="selectedEntity.type === 'polygon'">
                  <div class="form-group">
                    <label class="form-label">顶点（每行：经, 纬, 高）</label>
                    <textarea class="form-textarea" v-model="selectedEntity.positions" style="min-height:120px"></textarea>
                  </div>
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <input type="color" v-model="selectedEntity.color" style="width:34px;height:28px" />
                  </div>
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <label class="form-label" style="margin:0;min-width:auto">拉伸高度m</label>
                    <input class="form-input" type="number" v-model="selectedEntity.height" step="any" style="width:100px" placeholder="留空不拉伸" />
                  </div>
                </template>
                <template v-if="selectedEntity.type === 'label'">
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <input class="form-input" type="number" v-model.number="selectedEntity.lng" step="any" style="width:100px" placeholder="经度" />
                    <input class="form-input" type="number" v-model.number="selectedEntity.lat" step="any" style="width:100px" placeholder="纬度" />
                    <input class="form-input" type="number" v-model.number="selectedEntity.alt" step="any" style="width:80px" placeholder="高度" />
                  </div>
                  <div class="form-group"><label class="form-label">文本</label><input class="form-input" v-model="selectedEntity.text" /></div>
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <input type="color" v-model="selectedEntity.color" style="width:34px;height:28px" />
                    <label class="form-label" style="margin:0;min-width:auto">字号</label>
                    <input class="form-input" type="number" v-model.number="selectedEntity.size" step="any" style="width:70px" />
                  </div>
                </template>
                <template v-if="selectedEntity.type === 'ellipse'">
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <input class="form-input" type="number" v-model.number="selectedEntity.lng" step="any" style="width:100px" placeholder="经度" />
                    <input class="form-input" type="number" v-model.number="selectedEntity.lat" step="any" style="width:100px" placeholder="纬度" />
                    <input class="form-input" type="number" v-model.number="selectedEntity.alt" step="any" style="width:80px" placeholder="高度" />
                  </div>
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <label class="form-label" style="margin:0;min-width:auto">长半轴km</label>
                    <input class="form-input" type="number" v-model.number="selectedEntity.semiMajor" step="any" style="width:80px" />
                    <label class="form-label" style="margin:0;min-width:auto">短半轴km</label>
                    <input class="form-input" type="number" v-model.number="selectedEntity.semiMinor" step="any" style="width:80px" />
                  </div>
                  <div class="action-row" style="margin-bottom:0.5rem">
                    <input type="color" v-model="selectedEntity.color" style="width:34px;height:28px" />
                    <label class="form-label" style="margin:0;min-width:auto">旋转°</label>
                    <input class="form-input" type="number" v-model.number="selectedEntity.rotation" step="any" style="width:70px" />
                  </div>
                </template>
                <button class="btn btn-secondary btn-small" @click="del(selectedEntity.id)" style="width:100%;margin-top:0.5rem">删除该实体</button>
              </div>
            </template>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">CZML JSON 预览</span>
            <div class="spacer"></div>
            <span class="msg" :class="{ ok: czmlResult.warn.length === 0, warn: czmlResult.warn.length > 0 }">{{ czmlResult.warn.length ? '⚠ ' + czmlResult.warn.join('；') : '✓ 有效' }}</span>
            <button class="btn btn-secondary btn-small" @click="copyJson">复制</button>
            <button class="btn btn-primary btn-small" @click="downloadJson">下载</button>
          </div>
          <div class="panel-body">
            <div class="form-hint" style="margin-bottom:0.5rem">{{ entities.length }} 个实体 · {{ jsonText.split('\n').length }} 行 · {{ jsonText.length }} B</div>
            <textarea class="form-textarea" :value="jsonText" readonly style="min-height:400px"></textarea>
          </div>
        </section>
      </div>
      <div class="tool-footer">所有实体共享 document.clock · LAGRANGE 插值 · 纯本地</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { newEntity, buildPackets, TYPE_META, type CzmlEntity, type EntityType } from '../utils/czml-gen'

const router = useRouter()
const goBack = () => router.push('/')

const entities = ref<CzmlEntity[]>([newEntity('point'), newEntity('line'), newEntity('polygon')])
const selectedId = ref(entities.value[0]!.id)

const selectedEntity = computed(() => entities.value.find(e => e.id === selectedId.value) || null)

const czmlResult = computed(() => buildPackets(entities.value))
const jsonText = computed(() => JSON.stringify(czmlResult.value.packets, null, 2))

function add(type: EntityType) {
  const e = newEntity(type)
  entities.value.push(e)
  selectedId.value = e.id
}

function del(id: string) {
  entities.value = entities.value.filter(e => e.id !== id)
  if (selectedId.value === id) selectedId.value = entities.value[0]?.id || ''
}

function copyJson() {
  navigator.clipboard?.writeText(jsonText.value)
}

function downloadJson() {
  const d = new Date()
  const p2 = (n: number) => n < 10 ? '0' + n : '' + n
  const name = `czml-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}.json`
  const blob = new Blob([jsonText.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 600)
}
</script>

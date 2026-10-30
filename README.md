# 北京租房通勤对比（beijing-rent-commute）

纯前端开源工具：在地图上对比多个收藏房源到公司的通勤路线，并计算租房全成本与性价比推荐分，帮你在北京选到更合适的房子。

**在线演示：** https://ppppan9.github.io/beijing-rent-commute/

**仓库：** https://github.com/Ppppan9/beijing-rent-commute

## 功能

- **公司位置**：地址搜索 + 地图点选
- **收藏房源**：名称/地址、月租金、面积、押金月数、中介费、其他月支出、自定义单程通勤费、工作日天数、备注
- **北京地图**：公司 + 全部房源标注，绘制通勤路线（公交虚线 / 驾车实线）
- **通勤**：优先公交/地铁与驾车时长、距离（有高德 Key 时用真实路线；否则 OSRM 驾车 + 估算公交）
- **成本**：月租、押金、中介（一次性）、其他月支出、通勤月费、首月合计、年成本、**有效月成本**
- **推荐分**：在当前收藏集内归一化，综合通勤时长 + 有效月成本 + 面积性价比
- **对比表 / 排序筛选 / localStorage 持久化 / JSON 导入导出 / 移动端适配 / 一键示例数据**

### 成本字段

| 字段 | 说明 |
|------|------|
| 月租金 | 合同月租 |
| 押金 | 月租 × 押金月数 |
| 中介费 | 一次性 |
| 其他月支出 | 物业、宽带等 |
| 通勤月费 | 单程票价 × 2 × 每月工作日（可手填单程，或自动估算） |
| 首月合计 | 租金 + 押金 + 中介 + 其他 + 当月通勤 |
| 年成本 | 12×(租金+其他+通勤) + 中介（押金按可退不计） |
| 有效月成本 | 租金 + 其他 + 通勤 + 中介/12 + 押金×2%/12（资金占用） |

### 推荐分公式

在当前收藏列表内相对打分（0–100）：

```
推荐分 = 通勤分×40% + 成本分×45% + 面积分×15%
```

- **通勤分**：偏好模式下的时长越短越高（列表内 min-max 反归一化）
- **成本分**：有效月成本越低越高
- **面积分**：㎡ / 有效月成本 越高越好；若无人填写面积，则权重并入通勤与成本

可在「偏好」中切换公交优先 / 驾车优先。

## 技术栈

- Vite + React + TypeScript
- Leaflet + **高德底图**（标准矢量 / 影像，可切换；GCJ-02，与路线坐标一致）
- 可选：高德 Web 服务 API（地理编码 / 驾车 / 公交）
- 无后端，数据存 `localStorage`

## 本地运行

```bash
git clone https://github.com/Ppppan9/beijing-rent-commute.git
cd beijing-rent-commute
npm install
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

## 配置高德 Key（可选，强烈推荐北京真实公交）

1. 打开 [高德开放平台控制台](https://console.amap.com/dev/key/app) 注册/登录
2. 创建应用，添加 Key，**服务平台选「Web服务」**
3. 复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

4. 填入：

```env
VITE_AMAP_KEY=你的Web服务Key
```

5. 重启 `npm run dev`

> 浏览器直调高德 REST 时，请在控制台按官方要求配置安全密钥 / 域名白名单（GitHub Pages 域名为 `ppppan9.github.io`）。
> 底图始终为高德瓦片。若未配置 Web服务 Key，搜索/路线进入**演示模式**（地标 + Nominatim + OSRM/估算）；配置 `VITE_AMAP_KEY` 后启用真实 POI/公交/驾车。

### 关于 Key 类型

| 环境变量 | 高德控制台类型 | 用途 |
|----------|----------------|------|
| `VITE_AMAP_KEY` | **Web服务** | POI 搜索、地理编码、驾车/公交路线（当前线上已用） |
| `VITE_AMAP_JS_KEY` | **Web端(JS API)** | 可选。填写后启用官方 `AMap.Map` 矢量底图；不填则 Leaflet + 高德栅格瓦片 |
| `VITE_AMAP_SECURITY_CODE` | 安全密钥 | 配合 JS API Key，控制台「密钥」页配置 |

申请入口：[高德控制台 - 应用管理](https://console.amap.com/dev/key/app)。请为 Pages 域名 `ppppan9.github.io` 配置白名单。

### GitHub Actions 注入 Key（可选）

在仓库 Settings → Secrets 添加 `VITE_AMAP_KEY`，Pages 构建时会写入前端包。注意：前端 Key 会暴露在浏览器中，请用域名白名单与配额限制。

## GitHub Pages

本仓库通过 `.github/workflows/deploy-pages.yml` 在推送 `main` 后自动部署。

首次需在仓库 **Settings → Pages → Build and deployment** 选择 **GitHub Actions** 作为源。

## 隐私

所有房源与公司位置仅保存在你的浏览器 `localStorage`，不会上传到任何服务器。可用「导出 JSON」备份或跨设备迁移。



## 数据与备份（重要）

- **存储位置**：浏览器 `localStorage`，主键名固定为 **`beijing-rent-commute-v1`**（另有镜像键 `beijing-rent-commute-last-good`）。
- **网站更新 / GitHub Pages 重新部署不会清空**你的公司位置与收藏房源；schema 升级只做向前迁移（补字段），不会丢 listings。
- **会丢失数据的情况**：清除站点数据、换浏览器/换电脑、隐私模式、部分浏览器限制存储。
- **安全做法**：顶栏「导出备份」下载 JSON；换设备时用「导入」。收藏较多时会提示导出。
- **清空**：仅设置里「清空本地数据」且需两次确认；清空前会在本机另存一份带日期的备份键。

## 域名白名单（GitHub Pages）

在高德控制台为 **Web端(JS API)** Key 配置安全域名 / 白名单：

- `ppppan9.github.io`

并填写与 Key 配套的「安全密钥」到 `VITE_AMAP_SECURITY_CODE`（Actions Secret）。Web服务 Key（`VITE_AMAP_KEY`）继续用于 inputtips / POI / 路线。

## License

MIT

# Space Engine (Web)

在浏览器里探索整个宇宙，风格参考 [SpaceEngine](https://spaceengine.org)。无需安装，所有内容都在 WebGL2 里实时渲染。

- **太阳系**：按你屏幕上显示的日期运行真实星历（JPL 轨道根数、Meeus 月球理论、IAU 自转），昼夜线、月相、日月食都和现实一致。地球、月球、火星等用 NASA / USGS 的真实贴图和高程，近看有程序生成的细节，可以降落。
- **大气与光照**：按物理比例的大气散射（瑞利、米氏、臭氧），从地面看有日落、黄昏蓝调、气辉、星光闪烁和地平线消光。还有日食月食的本影半影、地照、土星环反光、极光和 SpaceEngine 风格的镜头光晕。
- **银河系**：程序生成的 3D 模型，从太阳附近看和 NASA 巡天照片对得上；尘埃固定在空间里，从里到外都是同一个物体。设置里可以切换成 NASA 照片对比。
- **整个宇宙**：按种子确定性生成，包括星系团、星系群、纤维结构和空洞，几万个星系都可以点选、搜索、飞过去。另有真实的本星系群和梅西耶星系。
- **星云和黑洞**：21 个真实星云（猎户、鹰状、玫瑰、马头等）是可以飞进去的体积渲染。黑洞有引力透镜和吸积盘，包括人马座 A\*、M87\*、天鹅座 X-1 和每个星系中心的黑洞。

## 快速开始

需要 Node.js 22.12 及以上版本，以及支持 WebGL2 的浏览器（推荐 Chrome 或 Edge）。

进入项目目录后执行：

```sh
npm install
npm run dev        # 高清版，打开 http://localhost:5173
```

线上部署默认使用轻量版，本地开发默认使用高清版；两版玩法相同，区别是素材分辨率和音乐码率。

| 命令 | 用途 |
|---|---|
| `npm run dev` | 本地运行高清版 |
| `npm run dev:lite` | 本地运行轻量版 |
| `npm run build` | 类型检查后构建轻量版到 `dist/`，部署这个目录即可 |
| `npm run deploy:cf` | 构建轻量版，再部署到名为 `spacex` 的 Cloudflare Worker |
| `npm run build:pages` | 类型检查后构建独立 Pages 轻量版到 `dist-pages/` |
| `npm run deploy:pages` | 构建 Pages 轻量版，再部署到独立 Cloudflare Pages 项目 |
| `npm run preview` | 预览 `dist/` |
| `npm run build:hd` | 类型检查后构建高清版到 `dist-hd/` |
| `npm run preview:hd` | 预览 `dist-hd/` |

轻量版的地表、云、夜景和银河照片最大宽度为 2048，高程为 1024×512；运行贴图约 8.2 MB，完整音乐约 14.9 MB，部署目录约 25 MB。默认出生点首次加载的地球和月球贴图约 3.1 MB，音乐另按播放加载。直接执行 `vite build` 也会使用轻量资源，只有显式 `--mode hd` 才构建高清版；缺少轻量资源会报错，不会回退到高清包。

**背景音乐**：进入页面会尝试自动播放内置曲目；浏览器拦截时，第一次点击或按键后自动开始。按 M 开关，音量和开关偏好会保留。轻量版关闭音乐后会停止远程音频加载，再次开启可续播；浏览器是否复用已下载数据取决于缓存。按 F4 可选择本地音频，也可以直接拖到窗口上，曲目保存在当前浏览器。高清版保留原始音乐，轻量版使用完整的 96kbps 双声道版本。

### 重新生成轻量资源

`public/` 保留高清素材，`public-lite/` 是已提交的轻量素材。普通运行和构建无需 Python、FFmpeg，也无需下载 Git LFS 原始数据。只有素材维护者重新生成时需要 Python 3.11+、Pillow、NumPy 和 PATH 中的 FFmpeg（含 ffprobe）：

```sh
python3 -m venv .texvenv
.texvenv/bin/pip install -r scripts/textures/requirements-lite.txt
PATH="$PWD/.texvenv/bin:$PATH" npm run assets:lite
```

生成器从现有高清素材生成轻量目录，通过校验后替换旧输出并清除过期文件，不改高清源文件。高程先解码真实高度再降采样，保持原始高度范围并重新编码为无损 PNG；不能把高程当普通 RGB 图片缩放或有损压缩。更新素材后需一并提交 `public-lite/`。

### 部署到 Cloudflare Workers

使用 Cloudflare Workers Static Assets 托管 `dist/`。首次部署前，登录 Cloudflare 并确认当前账号：

```sh
npx wrangler login
npx wrangler whoami
```

然后执行：

```sh
npm run deploy:cf
```

此命令先运行 `npm run build`，再运行 `wrangler deploy`，上传的始终是默认轻量版 `dist/`。轻量素材已经提交在 `public-lite/`，普通部署无需 Python、FFmpeg，也无需下载 Git LFS 原始素材。站点部署在域名根目录，使用 Cloudflare 默认缓存行为，不额外设置长期缓存规则。

根目录配置中的 Worker 名称为 `spacex`，下一次运行 `npm run deploy:cf` 会部署到此名称。已有线上 Worker `space-engine-lite` 及其原访问地址继续保留；修改本地配置不会自动重命名或删除旧 Worker。

`worker.mjs` 只为 `/music/soundtrack.mp3` 提供 HTTP Range 分段响应，让浏览器能够跳转和恢复播放进度；其余文件直接由静态资产服务提供。修改这部分逻辑后运行 `npm run test:cf`。

部署完成后，Wrangler 会输出默认的 `https://<worker-name>.<account-subdomain>.workers.dev` 地址。用实际地址替换下面的示例，在本机运行线上回归：

```sh
LOAD_TIMEOUT_MS=60000 URL=https://your-worker.your-subdomain.workers.dev/ node scripts/lite-test.mjs
URL=https://your-worker.your-subdomain.workers.dev/ node scripts/uitest.mjs
```

这两项检查需要本机 Chrome，分别验证轻量资源和音乐行为、界面与飞行操作。还应实际打开部署地址，确认星球画面正常渲染，并检查首页、JS/CSS、贴图和音乐请求成功；不能只以部署命令成功作为访问验收。

### 独立部署到 Cloudflare Pages

Pages 项目与 Worker 配置均命名为 `spacex`，它们是两个独立的部署目标。Worker 使用根目录的 `wrangler.jsonc`、`dist/` 和 `npm run deploy:cf`；Pages 使用 `deploy/pages/wrangler.jsonc` 和独立的 `dist-pages/`。Pages 不转发到旧 Worker，两套站点分别部署。已有线上 `space-engine-lite` Worker 仍保留原访问地址。

当前 Pages 正式地址为 <https://spacex.gemdzqq.com/>，默认地址为 <https://space-engine-pages.pages.dev/>。项目改名后默认地址仍保留原值，因此阿里云 CNAME 指向 `space-engine-pages.pages.dev`。

首次部署前，使用同一 Cloudflare 账号显式创建 Pages 项目：

```sh
npx wrangler pages project create spacex --cwd deploy/pages --production-branch feat/lite-version --force
```

当前 Wrangler 在 agent 环境中可能把新建静态 Pages 项目自动转为 Workers；首次创建加 `--force` 可确保创建 Pages。项目已存在时无需重复创建。生产分支固定为 `feat/lite-version`，与部署命令一致。

```sh
npm run build:pages   # 仅构建，不上传
npm run deploy:pages  # 构建并部署 Pages 生产环境
```

Pages 构建会将同一份 `worker.mjs` 复制为 `dist-pages/_worker.js`，并生成 `_routes.json`，仅让 `/music/soundtrack.mp3` 进入 Pages Functions。首页、JS/CSS 和贴图直接走静态托管；生成的 `404.html` 让不存在的路径返回 404。源码无需维护两份，Pages 产物也不会混入 Worker 的 `dist/`。当前 Wrangler 的 Pages 命令不支持自定义 `--config` 路径，因此通过 `--cwd deploy/pages` 加载独立配置。

部署成功后，先用 Wrangler 返回的实际 `pages.dev` 地址运行上面的两项浏览器回归，检查音乐分段请求返回 `206`、越界请求返回 `416`。确认正常后，再接入 `spacex.gemdzqq.com`：

1. 在 Cloudflare Pages 项目的「自定义域名」中添加 `spacex.gemdzqq.com`。
2. 在阿里云 DNS 添加 CNAME：主机记录为 `spacex`，记录值为此 Pages 项目的实际 `<项目名>.pages.dev` 域名。
3. 等待域名和 HTTPS 证书激活，再用 `https://spacex.gemdzqq.com/` 运行浏览器回归，检查首页、贴图、音乐播放与续播，并确认原 Worker 地址仍可访问。

主域名的 NS 和其他 DNS 记录继续保留在阿里云。必须先在 Pages 登记自定义域名，不能只添加 CNAME。

## 怎么玩

开局在地球附近。按 F1 可以随时查看全部按键。

| 按键 | 作用 |
|---|---|
| W / S、A / D、R / F | 前后、左右、上下 |
| Q / E | 翻滚 |
| 滚轮 或 + / − | 调速度（按住 Shift 时 ×10） |
| Z / X | 急停 |
| 左键拖动 | 环顾四周 |
| 右键拖动 | 绕选中的天体转 |
| 单击 | 选中天体 |
| 双击 或 G | 飞过去 |
| Shift+G | 降落 |
| 右键单击 | 天体菜单（选中、前往、降落、居中、跟踪、跟随、信息） |
| C | 居中选中天体 |
| T | 跟踪选中天体（保持居中） |
| Shift+F | 跟随选中天体移动 |
| H | 回地球 |
| Esc | 取消 |
| 空格 | 暂停时间 |
| L / K | 时间加快 / 减慢 10 倍 |
| J | 时间倒流 |
| \\ | 恢复实时 |
| F2 | 太阳系浏览器 |
| F3 | 搜索（恒星、行星、星系、星云、黑洞，可以按名字或 M / NGC / PGC 编号） |
| F4 | 设置 |
| F6 | 风景点 |
| I | 完整天体信息 |
| Shift+L | 标签 |
| O | 轨道 |
| \` 或 F10 | 隐藏界面 |

**一些可以去的地方**：
- 猎户座星云（F3 搜 "Orion"）
- 人马座 A\*（"Sgr A"）
- 仙女座星系（"Andromeda"）
- 土星环
- 地球夜面的城市灯光
- 2024-04-08 的日全食：在控制台运行 `se.date('2024-04-08T18:17Z')`

调试接口在浏览器控制台的 `se` 对象上，例如 `se.galaxy('M51')` 会返回 M51，再用 `se.go(...)` 飞过去。

## 项目结构

```
src/
  main.ts          帧循环、输入、选择、存档（刷新后保留位置）
  core/            单位、随机数
  universe/        数据与模拟：星历(ephemeris)、太阳系(sol)、生成的恒星系(system)、
                   恒星分区(galaxy)、星系与宇宙生成(universe, cosmos)、星云、黑洞
  render/          渲染：管线与曝光(pipeline)、星系(galaxyHost/galaxyShader)、星空(starfield)、
                   行星/地形/大气(planet*, terrain*, atmosphere*)、光照(lighting, star)、星云、黑洞透镜
  game/            HUD、对话框、标签、飞行与自动驾驶(player)、风景点
public/textures/   处理好的贴图（已提交，可直接使用）及来源说明 CREDITS.md
public-lite/       用于线上部署的轻量贴图、音乐和风景缩略图（已提交）
scripts/           截图与性能、运动测量工具（puppeteer），textures/ 下是贴图转换脚本
```

### 原始素材 `assets-src/`（Git LFS）

运行游戏只需要 `public/textures/` 里已经处理好的贴图，它们是普通文件，clone 下来就有。`assets-src/` 里是生成这些贴图用的原始下载，只有想重新生成贴图时才用得到。它通过 [Git LFS](https://git-lfs.com) 存放，而且**默认不下载**：仓库根目录的 `.lfsconfig` 排除了它，免得每次 clone 都消耗 LFS 流量。

需要时再下载：

```sh
git lfs install
git lfs pull --include="assets-src/**" --exclude=""
```

GitHub 免费的 LFS 空间只有 1 GB，所以仓库里只放了**地球**的全套原始数据（约 920 MB）：

| 文件 | 内容 | 来源 |
|---|---|---|
| `raw/sss/8k_earth_daymap.jpg`、`8k_earth_clouds.jpg`、`8k_earth_nightmap.jpg` | 地表颜色、云图、夜间灯光（8k） | Solar System Scope, CC BY 4.0 |
| `raw/nasa/BlackMarble_2016_3km.jpg` | 夜间灯光 | NASA Earth Observatory，公有领域 |
| `raw/nasa/PIA11707_orig.jpg` | NASA 原图 | NASA，公有领域 |
| `raw/etopo/etopo2022_60s_band*.nc` | 全球地形与海底高程（1 弧分，21600×10800） | NOAA ETOPO 2022，公有领域 |
| `previews/` | 处理过程中的对比预览图 | 由上述素材生成 |

其余原始素材**没有放进仓库**，`public/textures/` 里已经有它们处理好的版本，游戏照常使用。想重新生成的话，从官方地址下载到对应目录就行。每个文件的确切地址、署名和改动都在 [`public/textures/CREDITS.md`](public/textures/CREDITS.md) 里：

| 目录 | 内容 | 来源 |
|---|---|---|
| `raw/sss/` 其他文件 | 火星、水星、金星、木星、土星（含土星环）、天王星、海王星的贴图 | <https://www.solarsystemscope.com/textures/> |
| `raw/svs/` | 月球颜色与 LOLA 高程，以及 Milky Way 巡天图（EXR） | NASA SVS 4720 和 4851 |
| `raw/pds/` | 火星 MOLA 高程 | NASA PDS Geosciences |
| `raw/usgs/` | 木卫一到木卫四、土卫二、土卫六、海卫一、冥王星的全球拼图（约 1.3 GB） | USGS Astrogeology |
| `raw/galaxies/` | 星系照片 | ESA/Hubble、ESO，CC BY 4.0 |

星系、星云、星空本身都是程序生成的，不依赖这些照片；照片只用于对比，以及设置里可选的 "Milky Way photo" 显示。下载好之后运行 `scripts/textures/build.sh` 重新生成 `public/textures/`。这一步需要一个装了 numpy 和 Pillow 的 Python 虚拟环境 `.texvenv`：

```sh
python3 -m venv .texvenv && .texvenv/bin/pip install numpy pillow imagecodecs netCDF4
```

## 测试

```sh
npx tsc --noEmit
npm run build
node scripts/uitest.mjs          # 界面与操作的端到端检查，需要开着 dev 服务器
URL=http://127.0.0.1:4178/ node scripts/lite-test.mjs  # 轻量版网络与音乐回归
node scripts/gmotion.mjs         # 飞行时星系画面的流畅度（每帧运动、滞后、闪烁）
```

截图工具：`node scripts/gshot.mjs <名字> "<js>" [等待毫秒]`，结果在 `shots/`。这些工具用的是本机 Chrome（puppeteer-core），路径在脚本里。

轻量版回归前先运行 `npm run build`，再开一个终端运行 `npm run preview -- --port 4178`。可额外启动高清预览，并设置 `HD_URL=http://127.0.0.1:4179/` 一并检查高清音乐行为。`lite-test.mjs` 默认使用本机 Chrome，也支持通过 `CHROME_PATH` 指定浏览器路径。

## 素材与许可

贴图全部来自公有领域或 CC BY 4.0 来源，包括 NASA、USGS、NOAA、NASA SVS、Solar System Scope、ESA/Hubble 和 ESO。每个文件的来源、署名和改动见 [`public/textures/CREDITS.md`](public/textures/CREDITS.md)，游戏内按 F1 也能看到。没有使用 SpaceEngine 的任何素材。

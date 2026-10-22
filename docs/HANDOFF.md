# 云养宠物 · 项目交接文档

> 写给接手继续开发的 AI 助手或开发者。读完这一篇就能接着干,不需要翻聊天记录。
> 最后更新:2026-10-23,保留互动修复,按用户反馈撤回脸部调整。

---

## 1. 一句话概括

一个「云养宠物」网站:在浏览器里养宠物,宠物的饥饿、心情、清洁、精力会随真实时间下降,**关掉网页也照样算**,回来时宠物会有反应。
目前有两部分:

| 部分 | 入口 | 状态 |
| --- | --- | --- |
| **3D 写实小狗**(当前重点) | `public/dog.html` | 用户最关心的部分,最近几轮都在打磨它 |
| Q 版萌宠(8 种卡通宠物) | `public/index.html` | 功能完整,暂时不动 |

- 仓库:https://github.com/yiyayoh/cloud-pet (分支 `main`)
- 线上:https://yiyayoh.github.io/cloud-pet/ (Q 版)、https://yiyayoh.github.io/cloud-pet/dog.html (3D 小狗)
- 推送到 `main` 后 GitHub Actions 自动跑测试并发布到 GitHub Pages(`.github/workflows/pages.yml`,发布的是 `public/` 目录)。

---

## 2. 用户是谁、想要什么(很重要)

- 用户用**中文**交流,消息很短(比如「整体再优化一下」),希望你自己判断做什么、做完给看效果。
- 核心诉求:**宠物要可爱、要有互动感**。后来明确想要**写实**的小狗,参照《博德之门 3》里的狗「挠挠」(Scratch):**白色、毛茸茸、有点邋遢的串串狗**,半垂的耳朵。
- 走过的弯路(别再犯):
  - 第一次「写实版」是用 SVG 画得精致一点的卡通(8 种动物),用户很不满意:「你做的是啥啊,写实版你懂吗」。已全部删除(提交 `f8adca4` 回滚)。
  - 用户选了 **3D 立体小狗**,并说「先只做一只」。所以目前只有一只狗,不要擅自加品种。
- **不要使用 BG3 的名字、商标或游戏素材**。小狗只是外观参考,名字由用户首次打开时自己起(默认「小白」)。
- Q 版要保留,用户说过「Q 版保留,另加一版」。
- 用户主要在网站上看效果(可能是手机)。每次改完要推送上线,并给出能看的截图。

---

## 3. 怎么跑起来

```bash
npm start            # 本地服务器 http://localhost:3000(带账号接口)
npm test             # node:test,共 18 个测试,应全部通过
```

- **没有构建步骤**,没有 npm 运行时依赖。前端是原生 JS;3D 部分用 ES Module + importmap。
- three.js r170 已经拷贝在 `public/vendor/three/`(MIT 协议),不依赖 CDN。升级时要连同 `addons/` 里的三个文件一起换。
- 直接双击 `public/index.html` 也能玩 Q 版;3D 页面因为用了 ES Module,**必须通过 http 打开**(`npm start` 或任意静态服务器)。
- 环境变量:`PORT`(默认 3000)、`DATA_FILE`(存档文件,默认 `data/db.json`,已 gitignore)。

---

## 4. 目录结构

```
public/
  index.html, css/style.css      Q 版页面
  js/game.js                     ★ 游戏规则(两个页面共用),不碰 DOM,有单元测试
  js/pet-svg.js                  Q 版 8 种宠物的 SVG 画法、表情、装扮、蛋
  js/app.js                      Q 版的界面与互动(约 1000 行)
  js/minigame.js                 Q 版「接零食」小游戏
  js/sound.js                    全局音效开关 + Q 版音效(window.Sound)
  js/storage.js                  Q 版存档:localStorage + 可选云端同步(window.Store)

  dog.html, css/dog.css          3D 小狗页面
  js/dog3d/model.js              ★ 小狗模型:骨骼、身体部件、毛发着色器、眼鼻嘴
  js/dog3d/animator.js           ★ 姿势表 + 程序动画(走路、摇尾、看人、眨眼、甩水…)
  js/dog3d/main.js               ★ 行为调度、互动、道具、界面、主循环(约 1060 行)
  js/dog3d/scene.js              渲染器、灯光、地板、地毯、墙、镜头控制
  js/dog3d/sfx.js                小狗的声音(WebAudio 合成:叫、哈气、咀嚼…)
  vendor/three/                  three.js r170 + OrbitControls/RoomEnvironment/BufferGeometryUtils

server/server.js                 纯 Node 服务器:静态文件 + 注册/登录 + 存档(JSON 文件)
test/game.test.js                游戏规则测试
test/server.test.js              接口测试
tools/snapshot-dog.cjs           无显卡环境下给 3D 小狗截图/跑流程(见第 8 节)
docs/                            README 用的截图、本文档
```

---

## 5. 游戏规则层 `public/js/game.js`

两个页面共用,UMD 写法(浏览器挂 `window.Game`,Node 里 `require`)。**所有数值改动都应该在这里,并补测试。**

- 属性 0–100:`hunger 饱食`、`happy 心情`、`clean 清洁`、`energy 精力`。
- `tick(state, now)`:按 `now - updatedAt` 结算衰减(醒着每小时 饱食-6 心情-5 清洁-3 精力-4;睡着时精力每小时 +25,睡满自动醒)。离线时间就是靠它补算的。
- 成长:`xp` 达到 0/120/400 分别是 幼崽/少年/成年。3D 小狗按阶段缩放 0.8/0.9/1.0。
- 金币:每日签到 +20(`claimDaily`)、摸摸每 8 下 +1(每天上限 30)、Q 版小游戏得分。
- 动作函数都返回 `{ ok, reason?, levelUp? }`:`feed`、`stroke`、`scrub`、`playBall`、`sleep`/`wake`、`buy`、`toggleWear`、`finishGame`。
- `normalize(s)` 会补齐旧存档缺的字段,读档后一定要过一遍。
- **数值目前完全在前端计算,服务器照单全收**,玩家可以改 localStorage 作弊。

存档(localStorage 键):

| 键 | 内容 |
| --- | --- |
| `cloud-pet:v2` | Q 版宠物 |
| `cloud-pet:dog3d` | 3D 小狗(**和 Q 版是两份独立存档**,species 固定为 `dog`) |
| `cloud-pet:token` / `cloud-pet:user` | Q 版登录状态 |
| `cloud-pet:muted` | 声音开关(两个页面共用) |

---

## 6. 3D 小狗详解(当前重点)

### 6.1 模型 `model.js`

- **没有用外部 3D 模型文件**。原因:开发环境访问不到 Sketchfab 等素材站,能找到的免费带骨骼的狗都是低多边形卡通风。所以身体是用椭球和胶囊拼的,每个部件绑在一根骨头上(刚性蒙皮),合并成一个 `SkinnedMesh`。毛发很长,接缝都被盖住了。
- 狗面朝 **+Z**,**+X 是狗的左边**,单位是米,狗站立时头顶约 0.75m。
- `JOINTS`:所有关节在站姿下的世界坐标和父关节。共 19 根骨头:`root spine chest neck head jaw earL/R shoulderL/R elbowL/R hipL/R kneeL/R tail1/2/3`。
- `parts()`:每个部件 = 几何体 + 骨头名 + 毛长系数 + 颜色 + 毛的倒向(`comb`)。改体型主要改这里和 `JOINTS`。
- **毛发是 shell fur(多层壳)**:同一个几何体画 N 层(电脑 32 层,手机 22 层),每层沿法线外推一点,片元着色器按 3D 网格哈希决定哪里是「毛」、哪里丢弃。全部材质共享一个 shader 程序(`customProgramCacheKey`)。
  - 顶点属性:`aFur`(毛长系数,眼鼻嘴周围很短,眉毛胡子更长,见 `furMask`)、`aComb`(毛倒伏方向,会随骨骼一起转)、`color`。
  - 用户明确否定了缩眼、长口鼻和新胡须的脸部版本,认为变丑、不够可爱,已恢复 `5c01738` 的脸型、眼睛、耳朵和毛发。后续外观改动必须先提供局部预览,等用户认可后再替换线上版本。`dog.carryPoint` 是叼球在下颌骨骼内的位置,`dog.mouthPoint` 是检查进食接触的定位点;这些非可见定位点保留,进食姿势已适配恢复后的旧版口鼻。
  - 共享 uniform(`dog.uniforms`):`uLen` 毛长、`uDensity` 毛密度、`uTime` 微风、`uWet` 打湿程度(洗澡时 0→1,毛塌下来变暗)、`uDirt` 脏污、`uRim` 逆光透亮、`uHand`(xyz=手在模型局部坐标的位置,w=力度)和 `uHandDir`(摸摸时把毛压倒)。
  - 着色器是通过 `onBeforeCompile` 往 `MeshStandardMaterial` 里注入的,注入点:`#include <skinning_vertex>`、`#include <color_fragment>`、`#include <emissivemap_fragment>`。**升级 three.js 时这几个 chunk 名可能变,要检查。**
- 不长毛的部件挂在骨头上:眼睛(虹膜+瞳孔+角膜+深色眼眶,`dog.eyes` 是 Group,眨眼就是缩放 y)、鼻子(皮革凹凸贴图+鼻孔)、嘴巴线和人中、口腔、舌头(`dog.tongue`)。
- `dog.hit`:四个隐形球(头、胸、背、臀),用于点击和摸摸的射线检测。

### 6.2 动画 `animator.js`

- `POSES`:每个姿势是「相对站姿的骨骼旋转 + 身体下沉量」。现有 `stand feed(进食时弯腿俯身) sit paw(握手) scratch(后腿挠痒) lie sleep`。`anim.setPose(name)` 后会平滑过渡。
- 在姿势之上叠加程序动画,参数都在 `anim.v`,用 `anim.set(key, 目标值)` 平滑变化:
  `wag/wagFreq` 摇尾、`jaw` 张嘴、`tongue` 吐舌、`eyes` 睁眼程度(眯眼=0.3)、`ears` 耳朵竖起(负数=往后贴)、`tilt` 歪头、`headDown` 低头、`look` 看向 `anim.lookAt` 的权重、`lean` 身体侧倾。
- 开关型:`anim.pant` 哈气、`anim.chew` 咀嚼、`anim.scratching` 挠痒抖腿、`anim.shake = 秒数` 甩水。
- 走路动画由 `anim.v.walk` 驱动(main.js 移动时设置)。

### 6.3 行为与互动 `main.js`

- **行为调度**:`run(name, async (t) => {...}, { lock: true })` 启动一个行为,会取消上一个。行为里用 `await wait(ms, t)`、`await moveTo(target, speed, stopDist, t)`、`await faceTowards(point, t)`;取消时这些会抛出 `CANCEL`。`task` 是当前行为,`lock` 控制 `busy`(吃饭、洗澡、捡球时禁用动作按钮,轻点狗不会启动新动作)。资源收尾注册在 `t.cleanups`,取消时同步执行且仅执行一次;旧任务的异步 `finally` 不能重置新任务的动画或忙碌状态。移动和计时等待会在取消时立即拒绝,不能用覆盖 `move` 的方式遗忘旧 Promise。
- `moveTo` 的目标可以是函数(每帧重新取,用来追滚动的球)。到达判定有 1.5cm 容差,靠近时会减速——**这两点是修过的 bug,别删**(否则会绕着目标打转或永远到不了)。
- 现有行为:`doSit doLie doPaw doScratch doFeed doBath doSleep fetch(扔球捡回) callTo(点地板叫过来) doSniffAround doWander doComeHere`;`idle()` 每 4.5–8.5 秒随机挑一个自主行为(饿了会去饭碗边等、脏了会挠痒、困了会趴下),**刚互动过 9 秒内不会自己跑开**。
- 指针:在 `window` 上用**捕获阶段**监听 `pointerdown`,这样能抢在 OrbitControls 之前判断点到的是不是狗。点到狗 → 摸摸(拖动)或戳一下(短按);点到地板 → 扔球模式下扔球,否则叫它过来;拖空白处 → 旋转视角。
- 镜头会跟着狗平移(`followDog`),奔跑时跟得更快且略向头部偏移,避免竖屏追球时口鼻出屏。因此 `homePoint()` 要在出发时算一次并固定,不能每帧重算。
- 性能:`watchPerf` 发现平均低于约 38fps 就逐级降低毛发层数和像素比;切后台暂停渲染。
- 夜晚:`setNight(true)` 调暗灯光和曝光,界面切深色。
- **调试钩子**(截图脚本靠它们):`window.__dog`(模型)、`window.__anim`、`window.__three`(scene/camera/controls/renderer)、`window.__api`(`step(dt,t)` 手动推进一帧逻辑,以及各个 `doXxx`、`throwBall`、`state`、`task`)。
- 捡球行为函数现名 `fetchBall()`;不再遮住浏览器的全局 `fetch`。

### 6.4 界面 `dog.html` / `dog.css`

顶部 HUD(名字、成长阶段、金币、四条属性)、底部 7 个按钮(喂饭、扔球、洗澡、坐下、握手、趴下、睡觉)、提示文字、toast、首次起名弹窗。左上角「←」回 Q 版。Q 版右上角有「🐶 3D 小狗」入口。

---

## 7. 服务器 `server/server.js`(目前线上没用到)

纯 Node,无依赖。接口:`GET /api/health`、`POST /api/register`、`POST /api/login`、`POST /api/logout`、`GET/PUT /api/state`(Bearer token)。密码 scrypt 加盐,token 只存 sha256,登录失败限流。数据写 JSON 文件(先写临时文件再 rename)。

**GitHub Pages 只能放静态文件,所以线上是纯前端模式**:登录按钮会自动隐藏,存档只在浏览器里。要启用账号同步,需要把服务器部署到能跑 Node 的地方(Render/Railway/自己的服务器),用户还没提供这类账号。3D 小狗页面目前**没有接入**云同步。

---

## 8. 怎么验证改动(没有显卡也能看)

开发环境里没有 GPU,Chromium 用 SwiftShader 软件渲染,**连续动画非常慢,直接 `page.screenshot` 会超时**。办法是停掉渲染循环,用 `__api.step()` 推进逻辑,最后只渲染一帧:

```bash
npm i -D playwright              # 如果环境里还没有
PORT=3124 npm start &
node tools/snapshot-dog.cjs out.png                         # 默认机位
node tools/snapshot-dog.cjs face.png --cam 0.3,0.68,1.0 --target 0,0.58,0.33   # 脸部特写
node tools/snapshot-dog.cjs sit.png --pose sit              # 看某个姿势
node tools/snapshot-dog.cjs eat.png --action doFeed --ms 3000   # 跑 3 秒喂饭流程再截图
```

每次改模型/动画/行为,都应该截图自己看一眼再交给用户。改规则就跑 `npm test`。

新增 3D 浏览器回归工具(同样依赖 Playwright,不连续渲染):

```bash
node tools/check-dog.cjs http://localhost:3124/dog.html
```

共 12 项检查,覆盖忙碌保护、强制取消后的泡泡/湿毛/球清理、旧任务与新任务的竞争、正常洗澡/捡球/睡醒、成年与幼崽的进食接触、首次签到与刷新不重复领取、320 像素触控区域和左右追球镜头。可设置 `BROWSER_PATH` 为本机 Chrome 的可执行文件路径,否则使用 Playwright 下载的 Chromium。测试用隔离浏览器存档,不会碰用户存档。常规 CI 仍跑 `npm test` 的 18 项规则/接口测试,3D 回归需要另行运行。

2026-10-23 已用模拟触控和单帧截图验证本轮改动。真机帧率、发热、连续动画流畅度、自动画质降级效果和音效听感仍未验证。

---

## 9. 已知问题与限制

1. **真机性能没测过**:只在软件渲染下验证过画面和逻辑。手机上 22 层毛 × 约 2 万顶点的蒙皮,预计中高端机能流畅,低端机靠自动降级。用户还没反馈。
2. 狗的身体是基本形体拼的,近看腿比较像圆柱,脚掌没有肉垫细节;嘴只有张合,没有嘴唇形变。
3. 眨眼是把整个眼睛组缩扁(连眼眶一起),没有真正的眼皮。
4. 甩水、泡泡、水珠都比较简单;没有毛发和物体的碰撞。
5. 3D 小狗和 Q 版存档分开、金币不互通;3D 页面没有商店和装扮。
6. 数值全在前端,可以作弊(见第 5 节)。
7. GitHub Actions 有一条 Node 20 弃用的黄色警告,不影响发布,将来把 actions 版本升上去即可。
8. README 里的截图(`docs/pets.png` 等)只有 Q 版,没有 3D 小狗的图。

---

## 10. 建议的下一步(按优先级)

1. **请用户在手机上试 3D 小狗**,根据反馈调性能(毛层数 `buildDog({ layers })`、密度 `uDensity`、阴影贴图大小)和外观。这一步最重要,别闷头做新功能。
2. **外观先预览确认**:用户否定了上一轮脸部调整,已恢复修改前的外形。可爱感必须保住,不能把缩眼、拉长嘴简单当成写实。后续先做脸部的小范围预览给用户看,认可后再上线,不能擅自替换整只狗。
3. **补动作**:打滚、伸懒腰、讨食作揖、听到名字转头、跟着手指走;可以加「呼唤名字」按钮。
4. **3D 页面接入存档同步**(复用 `storage.js` 的思路),并把服务器部署出去(需要用户提供平台账号)。
5. 3D 页面加商店/装扮(项圈、小围巾),复用 `game.js` 的 `ITEMS`,挂在 `neck`/`head` 骨头上。
6. 把 README 的介绍换成 3D 小狗为主,补一张 3D 截图。
7. 如果以后能拿到授权合适的写实狗模型(glTF,带骨骼),可以替换 `model.js` 里的拼接身体,保留毛发着色器和行为系统;骨骼名对应好就能复用 `animator.js`。

---

## 11. 踩过的坑(备忘)

- Q 版:选择器 `.tabs button` 曾同时命中商店和其他标签栏,导致按钮失灵。现在商店用 `#panel-shop .tabs button`。
- 3D:`MeshPhysicalMaterial` 的 `transmission` 会让渲染器多画一遍场景,很耗性能。眼睛和水珠已改成透明 + clearcoat,不要再用 transmission。
- 3D:球的活动范围必须小于狗能走到的范围,否则球滚到墙角,狗永远捡不到。现在还有 9 秒超时兜底。
- 3D:镜头跟随会改变 `camera.position`,任何「相对镜头」计算的目标点都要在出发时算好再固定。
- 3D:洗澡取消时必须移除泡泡、释放临时几何体、恢复 `uWet`;捡球取消时必须把球从下颌骨骼移回场景。不要只禁用按钮而遗漏真正的取消收尾。
- 部署在子路径 `/cloud-pet/` 下,所有资源路径都必须是相对路径(importmap 用的是 `./vendor/...`)。
- 提交信息用中文,写清楚改了什么、为什么。

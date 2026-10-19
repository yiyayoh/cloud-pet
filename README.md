# ☁️ 云养宠物

一个在浏览器里养电子宠物的小网站。领养一只宠物,喂食、玩耍、洗澡、哄睡;关掉页面后时间照样流逝,回来时宠物的状态会按离开的时长变化。

## 运行

纯静态页面,无需构建:

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

或直接双击 `index.html`。

## 当前功能

- 8 种宠物可选,自定义名字
- 饱食 / 心情 / 清洁 / 精力四项属性,随时间衰减(离线也计算)
- 喂食、玩耍、洗澡、睡觉四种互动
- 数据保存在浏览器 localStorage

## 后续计划

- [ ] 用户账号 + 后端存储,换设备也能看到宠物
- [ ] 成长阶段与进化
- [ ] 小游戏赚金币、商店买食物和装扮
- [ ] 好友互访、宠物广场

## 参考项目

- [GitHub topic: tamagotchi](https://github.com/topics/tamagotchi)
- [usik/tamagotchi](https://github.com/usik/tamagotchi):还原原版拓麻歌子的养成机制
- [kjdowns/pokepet](https://github.com/kjdowns/pokepet):Rails 宠物养成网页

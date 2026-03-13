# open-pokemon-claw 下一步清单（2026-03-13）

## 今天

- [x] 复核公网主链路：status / task stats / task runtime / diagnostics / websocket
- [x] 补一键巡检脚本：`scripts/check-live-health.sh`
- [x] 修复前端 `app.js` 里的实时连接阻断问题（语法错误 + 缺失常量/状态函数）
- [ ] 在真实浏览器里挂页观察 `diagnostics.activeConnections > 0` 是否稳定保持
- [x] 提交并发布当前稳定基线
- [x] 建立前端双模式：开发源码直跑 / 生产轻构建 + Node 动态聚合
- [x] 收口 Nginx 路由：API / WS / 静态资源分流处理
- [x] 增加部署脚本：build -> restart -> health check

## 本周

- [ ] 把当前任务卡升主位
- [ ] 右栏重构为：当前任务 / 系统摘要 / 最近事件
- [ ] 将日志收敛成时间线，不再堆原始细节
- [ ] 分离行为态与健康态
- [ ] 明确 warning / alarm 的进入条件

## 后续

- [ ] 强化最小控制闭环：retry / resolve / agent turn
- [ ] 做一轮真实试用验证
- [ ] 收口响应式和文案细节

## 运维说明

如果你希望前端页面保持实时连接，前提是：

1. 页面必须实际打开着
2. 前端 JS 成功执行并建立 `WS /ws/openclaw/status`
3. 代理层不要把 websocket upgrade 吃掉

建议用下面两步确认：

```bash
# 1) 打开页面后，看连接数是否 > 0
curl -fsS https://www.wangyuye.online/open-pokemon-claw/api/openclaw/diagnostics | jq '.data.ws.activeConnections'

# 2) 跑一键巡检
bash scripts/check-live-health.sh
```

# ECS 微信关注者同步

独立容器复用现有同步代码与 Prisma schema，不迁移数据库、不启动 Web 服务。

## 打包与安装

在仓库中执行：

```sh
python3 main/deploy/wechat-sync/bundle.py /tmp/dimsum-wechat-sync.tar.gz
```

将压缩包传入目标 ECS 后，以 root 在独立目录解压并构建：

```sh
install -d -m 755 /opt/dimsum-wechat-sync
tar -xzf /tmp/dimsum-wechat-sync.tar.gz -C /opt/dimsum-wechat-sync
cd /opt/dimsum-wechat-sync
chmod 755 run.sh
docker build -t dimsum-wechat-sync:local .
install -d -m 700 /etc/dimsum-wechat-sync
```

首次安装前确认目录不存在或属于本任务。升级时保留旧镜像和配置以便回退。
Docker 内用 Node 22 和非 root 用户运行，不改动主机的 Node 版本。

本次 ECS 的 Docker Hub 和 npm 官方源超时，已有阿里云 Node 基础镜像。
可用以下备用构建方式：在现有基础镜像中安装独立 Node 22.22.1，
只对构建指定可达下载源，npm 依赖仍由锁文件校验完整性：

```sh
docker build -f Dockerfile.ecs \
  --build-arg NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
  --build-arg PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma \
  -t dimsum-wechat-sync:local .
```

## 凭据与验证

将以下 Production 配置写入 `/etc/dimsum-wechat-sync/worker.env`，一行一个
`KEY=value`，不加 shell 引号；文件权限 `600`，属主 root。不得写入 Git、终端历史或日志。

- `DATABASE_URL`、`DIRECT_URL`
- `WECHAT_SERVICE_APPID`、`WECHAT_SERVICE_SECRET`

先验证数据库认证和微信令牌，输出仅包含数量、错误码和被拒绝的出口 IP：

```sh
docker run --rm --env-file /etc/dimsum-wechat-sync/worker.env \
  dimsum-wechat-sync:local node preflight.mjs
```

若微信返回 `40164`，将实际出口 IP 加入服务号白名单后重新验证。成功前不要启用定时任务。
成功后先执行 `./run.sh pending` 检查新关注者绑定结果，再执行 `./run.sh full` 补齐历史关注者。
无 UnionID、未匹配平台账号等结果不等于 API 请求失败，需单独核对开放平台关联及用户登录。

## 定时执行

首次同步验收后执行：

```sh
install -m 644 dimsum-wechat-sync@.service /etc/systemd/system/
install -m 644 dimsum-wechat-sync-pending.timer dimsum-wechat-sync-full.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now dimsum-wechat-sync-pending.timer dimsum-wechat-sync-full.timer
systemctl list-timers 'dimsum-wechat-sync-*'
```

增量每小时、全量每天北京时间 03:20。两个任务共用 flock 锁；锁忙时本次跳过。
任务运行上限两小时，容器限制 512 MiB 内存和 0.5 CPU；超时后待后续执行重试。
全量同步为一轮完整扫描，大规模关注者需再实现持久化游标。

日志：`journalctl -u 'dimsum-wechat-sync@*' --since today --no-pager`。
暂停：`systemctl disable --now dimsum-wechat-sync-pending.timer dimsum-wechat-sync-full.timer`。
暂停定时器不会中断正在执行的任务；如需中断，再停止对应的 service。

此 worker 不发送微信消息。agent 的发送路径及令牌管理需要单独联调。

import type { AuthSession } from "../auth/session";


type HomePageProps = {
  session: AuthSession;
};

const statusCards = [
  {
    title: "健康建档",
    summary: "注册账号已完成，家庭空间已经建立。",
    tone: "bg-soft-sage text-[#3E5C3A]",
  },
  {
    title: "成员管理",
    summary: "下一步可以开始添加老人、儿童等被照护成员。",
    tone: "bg-[#FEF5ED] text-[#9a6d3b]",
  },
  {
    title: "权限准备",
    summary: "管理员与普通成员角色边界已经就绪。",
    tone: "bg-gentle-blue text-[#41678b]",
  },
];

const checklist = [
  "连接 /api/auth/login 与 /api/auth/register 的真实后端接口",
  "补齐成员列表与新增成员表单",
  "在 Phase 2 接入健康事实层与首页聚合数据",
];

export function HomePage({ session }: HomePageProps) {
  return (
    <section className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-warm-gray/65">家庭空间概览</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-[#2D2926]">欢迎回来，{session.member.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-warm-gray">
              当前登录身份为 {session.user.role === "admin" ? "家庭管理员" : "家庭成员"}。Phase 1
              已经打通注册、登录和基础布局，后续页面可以在这层壳里持续扩展。
            </p>
          </div>
          <div className="rounded-full border border-[#F2EDE7] bg-white px-4 py-2 text-sm font-semibold text-apple-blue shadow-soft">
            HomeVital MVP v1 / Phase 1
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
        <div className="space-y-6">
          <article className="overflow-hidden rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white shadow-card">
            <div className="grid gap-6 px-8 py-8 md:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="inline-flex rounded-full bg-[#F5F0EA] px-4 py-2 text-xs font-semibold tracking-[0.22em] text-warm-gray/80">
                  Phase 1 基础布局已就绪
                </p>
                <h3 className="mt-5 text-3xl font-bold tracking-tight text-[#2D2926]">认证流与应用骨架已经衔接</h3>
                <p className="mt-4 max-w-xl text-sm leading-7 text-warm-gray">
                  登录与注册页沿用了暖色、浅蓝和圆角卡片的视觉方向；进入应用后，顶部 header、左侧成员导航和主内容区也已经按照首页原型的结构拆出。
                </p>
              </div>
              <div className="rounded-[2rem] bg-[linear-gradient(145deg,#f7fbff_0%,#eef5f1_45%,#fcf9f5_100%)] p-5">
                <div className="grid gap-3">
                  {statusCards.map((card) => (
                    <div
                      className={`rounded-[1.4rem] px-4 py-4 text-sm font-medium shadow-soft ${card.tone}`}
                      key={card.title}
                    >
                      <p className="text-xs uppercase tracking-[0.26em] text-current/70">{card.title}</p>
                      <p className="mt-2 leading-6">{card.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-8 py-7 shadow-card">
            <h3 className="text-2xl font-bold tracking-tight text-[#2D2926]">接下来可直接承接的页面能力</h3>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[2rem] bg-[#F9EBEA] px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[#b56a6a]">Auth</p>
                <p className="mt-3 text-sm leading-6 text-[#7e5656]">可直接接入记住登录态、忘记密码和首次启动引导。</p>
              </div>
              <div className="rounded-[2rem] bg-gentle-blue px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[#52779b]">Members</p>
                <p className="mt-3 text-sm leading-6 text-[#4b6987]">侧栏已经预留成员列表结构，下一步只需替换为真实 API 数据。</p>
              </div>
              <div className="rounded-[2rem] bg-soft-sage px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[#55745d]">Dashboard</p>
                <p className="mt-3 text-sm leading-6 text-[#4f6b56]">主内容区已做好可伸缩卡片容器，适合继续拼装提醒流与首页摘要。</p>
              </div>
            </div>
          </article>
        </div>

        <aside className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-6 shadow-card">
          <h3 className="text-xl font-bold tracking-tight text-[#2D2926]">本阶段检查单</h3>
          <ul className="mt-5 space-y-4">
            {checklist.map((item) => (
              <li className="rounded-[1.4rem] bg-warm-cream px-4 py-4 text-sm leading-6 text-warm-gray" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

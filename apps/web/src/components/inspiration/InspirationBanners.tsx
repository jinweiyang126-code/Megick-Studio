/** MagiCoreAI inspiration banners — Figma 79:2374 / 79:2375 (954×208 / 748×208, r=12). */
const BANNERS = [
  {
    id: "collection",
    src: "/brand/magicore/banner-collection.png?v=4",
    width: 954,
    height: 208,
    alt: "MagiCoreAI 魔核高能创作合辑",
  },
  {
    id: "agent",
    src: "/brand/magicore/banner-agent.png?v=4",
    width: 748,
    height: 208,
    alt: "让 Agent 调度可灵，灵感批量出片",
  },
] as const;

export function InspirationBanners() {
  return (
    <section
      className="mx-auto grid w-full max-w-[1714px] grid-cols-1 gap-3 lg:grid-cols-[954fr_748fr]"
      data-figma-node="79:2374,79:2375"
    >
      {BANNERS.map((banner) => (
        <img
          key={banner.id}
          src={banner.src}
          alt={banner.alt}
          width={banner.width}
          height={banner.height}
          className="h-auto w-full rounded-[12px] object-cover"
          draggable={false}
        />
      ))}
    </section>
  );
}

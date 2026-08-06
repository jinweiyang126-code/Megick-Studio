/**
 * Figma MegiCoreAI node 238:6440 — `bg-top`
 * Transparent plate (glow + decorative prompt bar). Page fill is parent `#0a0a0a`.
 * Desktop: full plate. Mobile: plate omitted — prompt+glow are one HTML unit in MagiCoreHomePage
 * (Frame 56 / Group 5 composition) so the bar stays readable.
 * @see https://www.figma.com/design/A8pVy0Wd7vLufWQdKqu9wB/MegiCoreAI?node-id=238-6440
 */
const BG_TOP_SRC = "/brand/magicore/home/hero-bg-top.png?v=8";

export function MagiCoreBgTop() {
  return (
    <img
      src={BG_TOP_SRC}
      alt=""
      aria-hidden
      data-node-id="238:6440"
      data-name="bg-top"
      className="pointer-events-none absolute inset-0 z-0 hidden size-full select-none object-cover object-top md:block"
      draggable={false}
    />
  );
}

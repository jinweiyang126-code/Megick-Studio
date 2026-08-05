/**
 * Figma MegiCoreAI node 238:6440 — `bg-top`
 * Transparent plate (glow + decorative prompt bar). Page fill is parent `#0a0a0a`.
 * Parent must establish size (homepage uses aspect-ratio 1920/1080).
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
      className="pointer-events-none absolute inset-0 z-0 size-full select-none object-cover object-top"
      draggable={false}
    />
  );
}

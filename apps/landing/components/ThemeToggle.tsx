"use client";
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme");
    const next =
      cur === "light" ? "dark" : cur === "dark" ? "light"
      : matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";
    root.setAttribute("data-theme", next);
  };
  return (
    <button className="themebtn" aria-label="Toggle color theme" onClick={toggle}>◐</button>
  );
}

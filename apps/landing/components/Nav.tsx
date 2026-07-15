import { Cta } from "./Cta";
import { ThemeToggle } from "./ThemeToggle";

export function Nav() {
  return (
    <nav id="nav">
      <a href="#top" className="brand"><span className="spark" /> PromptForge</a>
      <div className="navlinks">
        <a href="#loop">The loop</a>
        <a href="#modes">Modes</a>
        <a href="#coverage">Coverage</a>
        <a href="#proof">Proof</a>
        <ThemeToggle />
        <Cta to="store" className="cta">Get the extension</Cta>
      </div>
    </nav>
  );
}

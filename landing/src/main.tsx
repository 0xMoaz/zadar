import { createRoot } from "react-dom/client"
import { ZadarDemo } from "./ZadarDemo"
import "./styles.css"

// no StrictMode — the scenario timeline uses timers; double-invoked effects would
// run two loops in dev. (In Next.js this component is just `<ZadarDemo/>`.)
createRoot(document.getElementById("root")!).render(<ZadarDemo />)

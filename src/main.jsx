// This is the browser entry point. Keeping it tiny makes it easy to see
// where React starts without mixing setup code with application features.
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")).render(<App />);

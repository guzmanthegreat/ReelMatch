// Connects the React app to the webpage.
import { createRoot } from "react-dom/client";
// Loads the main component that contains the app screens.
import App from "./App";
// Loads styles shared by all screens.
import "./styles.css";

// Render App inside the root element from index.html.
const rootElement = document.getElementById("root");
const appRoot = createRoot(rootElement);
appRoot.render(<App />);

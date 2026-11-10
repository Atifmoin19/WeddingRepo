import { createRoot } from "react-dom/client";

// No router: "/admin" is the host panel, every other path is the invitation.
// Two separate import() statements on purpose: Vite attaches each chunk's own CSS to its import,
// and gets that wrong when both sit in one conditional expression.
const mount = ({ default: App }) => createRoot(document.getElementById("root")).render(<App />);
if (/^\/admin\/?$/.test(location.pathname)) import("./admin/AdminApp.jsx").then(mount);
else import("./invite/InviteApp.jsx").then(mount);
